import type { Lead, LeadMeta } from '../../types/lead.d.ts'; 

export function parseLeadData(data: any): Lead {
  
  const formData = data.data || data;
  
  if (!formData.submissionId) {
    console.error('Missing submissionId in data:', formData);
    throw new Error('Missing submissionId in lead data');
  }

  if (!formData['field:last_name'] || !formData['field:email'] || !formData['field:message_to_the_breeder']) {
    console.error('Missing required fields in data:', formData);
    throw new Error('Missing required fields in lead data');
  }
  
    return {
      id: formData.submissionId,
      contact: {
        name: formData['field:last_name'],
        email: formData['field:email'],
        phone: formData['field:phone_57c8'] || undefined
      },
      text: formData['field:message_to_the_breeder'],
      createdAt: formData.submissionTime,
    };
  }
  