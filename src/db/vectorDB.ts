import 'dotenv/config';
import type { Lead, LeadMeta } from '../../types/lead.d.ts'; 
import { Pinecone, type IndexModel, Index } from '@pinecone-database/pinecone';
import { parseLeadData } from '../utils/leadParser.ts';

export async function createIndexIfNotExists(indexName: string, dbInstance: Pinecone): Promise<IndexModel> {
  try {
    
    const existingIndex = await dbInstance.describeIndex(indexName);
    return existingIndex;
  } catch (error) {
    try {
      await dbInstance.createIndexForModel({
        name: indexName,
        cloud: "aws",
        region: "us-east-1",
        embed: {
          model: "llama-text-embed-v2",
          fieldMap: { text: "chunk_text" }, 
          metric: "cosine",
        },
        waitUntilReady: true
      });

      const indexModel = await dbInstance.describeIndex(indexName);
      return indexModel;
    } catch (createError) {
      console.error('Error creating index:', createError);
      throw createError;
    }
  }
}

export async function uploadDataToIndex(index: Index<LeadMeta>, lead: Lead): Promise<void> {
  try {

    if (!lead.id || lead.id.trim() === '') {
      throw new Error('Lead ID is required and cannot be empty');
    }

    const record = {
      id: lead.id,
      chunk_text: lead.text,
      lead_id: lead.id,
      name: lead.contact.name,
      email: lead.contact.email,
      phone: lead.contact.phone ?? '',
      text : lead.text,
      createdAt: lead.createdAt,
    };

    console.log('Uploading record to Pinecone:', JSON.stringify(record, null, 2));
    
    await index.upsertRecords([record]);
  } catch (error) {
    console.error('Error uploading data to index:', error);
    throw error;
  }
}

export async function leadHandler(data: any, index: Index<LeadMeta>): Promise<void> {
  try {
    console.log('Received data:', JSON.stringify(data, null, 2));
    
    const lead = parseLeadData(data);
    console.log('Parsed lead:', JSON.stringify(lead, null, 2));
    
    await uploadDataToIndex(index, lead);
    console.log('Lead data uploaded successfully:', lead);
  } catch (error) {
    console.error('Failed to upload lead data:', error);
    throw error; 
  }
}