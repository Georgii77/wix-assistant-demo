
import { google } from "googleapis";
import http from "http";
import url from "url";
import fs from "fs";
import open from "open";
import path from "path";


const SCOPES = ["https://www.googleapis.com/auth/gmail.send"];
const CRED_PATH = path.resolve("client_secret.json");
const TOKEN_PATH = path.resolve("token.json");


function sanitizeHeaderValue(s: string) {
 
  return String(s).replace(/[\r\n]/g, "").trim();
}

function sanitizeMailbox(s: string) {
  const cleaned = String(s).replace(/[\r\n]/g, "").trim();
  
  const m = cleaned.match(/<?\s*([^\s<>"]+@[^\s<>"]+)\s*>?/);
  return m ? m[1] : "";
}

function isEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function encodeHeaderUTF8(str: string) {
  
  return /[^\x00-\x7F]/.test(str)
    ? `=?UTF-8?B?${Buffer.from(str, "utf8").toString("base64")}?=`
    : str;
}

function toBase64Url(s: string) {
  return Buffer.from(s, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_");
}


async function getOAuth2Client() {
  const raw = fs.readFileSync(CRED_PATH, "utf8");
  const { installed, web } = JSON.parse(raw);
  const cfg = installed ?? web;

  if (!cfg?.client_id || !cfg?.client_secret || !(cfg.redirect_uris?.length)) {
    throw new Error("client_secret.json is missing client_id/client_secret/redirect_uris");
  }

  const redirectUri: string = cfg.redirect_uris[0];
  const oAuth2Client = new google.auth.OAuth2(cfg.client_id, cfg.client_secret, redirectUri);

  if (fs.existsSync(TOKEN_PATH)) {
    oAuth2Client.setCredentials(JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8")));
    return oAuth2Client;
  }

  
  const authorizeUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });
  await open(authorizeUrl);

  const code: string = await new Promise((resolve, reject) => {
    const srv = http.createServer((req, res) => {
      try {
        const qs = new url.URL(req.url || "", redirectUri).searchParams;
        const c = qs.get("code");
        if (!c) throw new Error("No code in callback");
        res.end("Authorization success! You can close this tab.");
        srv.close();
        resolve(c);
      } catch (e) {
        srv.close();
        reject(e);
      }
    });
    const { hostname, port } = new URL(redirectUri);
    srv.listen(Number(port || 80), hostname);
  });

  const { tokens } = await oAuth2Client.getToken(code);
  oAuth2Client.setCredentials(tokens);
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));

  return oAuth2Client;
}


export async function sendWithGmailAPI(opts: {
  from: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
}) {
  const auth = await getOAuth2Client();
  const gmail = google.gmail({ version: "v1", auth });

  const from = sanitizeHeaderValue(opts.from);
  const to = sanitizeMailbox(opts.to);
  if (!isEmail(to)) throw new Error(`Invalid email in "to": ${JSON.stringify(to)}`);

  const subject = encodeHeaderUTF8(sanitizeHeaderValue(opts.subject));
  const isHtml = !!opts.html;
  const body = opts.html ?? opts.text ?? "";

  
  const bodyB64 = Buffer.from(body, "utf8").toString("base64")
                    .replace(/.{1,76}/g, "$&\r\n"); 

  const mime =
    `From: ${from}\r\n` +
    `To: ${to}\r\n` +
    `Subject: ${subject}\r\n` +
    `MIME-Version: 1.0\r\n` +
    `Date: ${new Date().toUTCString()}\r\n` +
    `Content-Type: ${isHtml ? "text/html" : "text/plain"}; charset="UTF-8"\r\n` +
    `Content-Transfer-Encoding: base64\r\n\r\n` +
    bodyB64 + `\r\n`;

  const raw = Buffer.from(mime, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_");


  await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
}


export { getOAuth2Client };




