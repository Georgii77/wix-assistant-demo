export type ContactInfo = {
  name: string;      
  email: string;     
  phone?: string;    
};

export type Lead = {
  id: string;        
  contact: ContactInfo;
  text: string;     
  createdAt: string;   
};

export interface LeadMeta extends Record<string, string | number | boolean > {
  lead_id: string;
  name: string;
  email: string;
  phone?: string;
  text: string; 
  createdAt: string;
}
