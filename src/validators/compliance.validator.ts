import { z } from 'zod';

// ============================================
// COMPLIANCE TEMPLATES
// ============================================

export const createTemplateSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Template name is required'),
    description: z.string().optional(),
    location_id: z.string().uuid().optional(),
    category: z.enum(['temperature', 'cleaning', 'receiving', 'allergen', 'pest_control']),
    frequency: z.enum(['hourly', 'daily', 'weekly', 'monthly', 'quarterly']),
    time_windows: z.array(z.object({
      start: z.string().regex(/^\d{2}:\d{2}$/),
      end: z.string().regex(/^\d{2}:\d{2}$/),
    })).optional(),
    checklist_items: z.array(z.object({
      id: z.string(),
      prompt: z.string(),
      type: z.enum(['boolean', 'number', 'text', 'select', 'photo']),
      options: z.array(z.string()).optional(),
      critical: z.boolean().optional(),
      photo_required: z.boolean().optional(),
    })),
    regulatory_reference: z.string().optional(),
  }),
});

export const updateTemplateSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    location_id: z.string().uuid().nullable().optional(),
    category: z.enum(['temperature', 'cleaning', 'receiving', 'allergen', 'pest_control']).optional(),
    frequency: z.enum(['hourly', 'daily', 'weekly', 'monthly', 'quarterly']).optional(),
    time_windows: z.array(z.object({
      start: z.string().regex(/^\d{2}:\d{2}$/),
      end: z.string().regex(/^\d{2}:\d{2}$/),
    })).optional(),
    checklist_items: z.array(z.object({
      id: z.string(),
      prompt: z.string(),
      type: z.enum(['boolean', 'number', 'text', 'select', 'photo']),
      options: z.array(z.string()).optional(),
      critical: z.boolean().optional(),
      photo_required: z.boolean().optional(),
    })).optional(),
    regulatory_reference: z.string().optional(),
    is_active: z.boolean().optional(),
  }),
});

// ============================================
// COMPLIANCE CHECKS
// ============================================

export const createCheckSchema = z.object({
  body: z.object({
    location_id: z.string().uuid(),
    template_id: z.string().uuid().optional(),
    check_type: z.string(),
    scheduled_at: z.string().datetime().optional(),
  }),
});

export const submitCheckSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    responses: z.array(z.object({
      item_id: z.string(),
      value: z.union([z.string(), z.number(), z.boolean()]),
      notes: z.string().optional(),
      photo_url: z.string().url().optional(),
      timestamp: z.string().datetime().optional(),
    })),
    signature_url: z.string().url().optional(),
    gps_location: z.object({
      lat: z.number(),
      lng: z.number(),
      accuracy: z.number().optional(),
    }).optional(),
  }),
});

export const listChecksSchema = z.object({
  query: z.object({
    location_id: z.string().uuid().optional(),
    status: z.enum(['pending', 'passed', 'failed', 'corrective_action']).optional(),
    check_type: z.string().optional(),
    start_date: z.string().datetime().optional(),
    end_date: z.string().datetime().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    offset: z.coerce.number().int().min(0).optional(),
  }),
});

// ============================================
// TEMPERATURE LOGS
// ============================================

export const createTemperatureLogSchema = z.object({
  body: z.object({
    location_id: z.string().uuid(),
    equipment_id: z.string().uuid().optional(),
    reading_celsius: z.number(),
    reading_type: z.enum(['fridge', 'freezer', 'hot_holding', 'cooking', 'delivery']),
    item_name: z.string().optional(),
    lower_limit: z.number().optional(),
    upper_limit: z.number().optional(),
    corrective_action_taken: z.string().optional(),
    photo_url: z.string().url().optional(),
  }),
});

export const listTemperatureLogsSchema = z.object({
  query: z.object({
    location_id: z.string().uuid().optional(),
    equipment_id: z.string().uuid().optional(),
    reading_type: z.enum(['fridge', 'freezer', 'hot_holding', 'cooking', 'delivery']).optional(),
    breaches_only: z.coerce.boolean().optional(),
    start_date: z.string().datetime().optional(),
    end_date: z.string().datetime().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    offset: z.coerce.number().int().min(0).optional(),
  }),
});

// ============================================
// EQUIPMENT
// ============================================

export const createEquipmentSchema = z.object({
  body: z.object({
    location_id: z.string().uuid(),
    name: z.string().min(1, 'Equipment name is required'),
    equipment_type: z.enum(['fridge', 'freezer', 'hot_holding', 'probe', 'dishwasher']),
    serial_number: z.string().optional(),
    manufacturer: z.string().optional(),
    model: z.string().optional(),
    temp_lower_limit: z.number().optional(),
    temp_upper_limit: z.number().optional(),
    calibration_due_date: z.string().datetime().optional(),
    next_service_date: z.string().datetime().optional(),
  }),
});

export const updateEquipmentSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    name: z.string().optional(),
    equipment_type: z.enum(['fridge', 'freezer', 'hot_holding', 'probe', 'dishwasher']).optional(),
    serial_number: z.string().optional(),
    manufacturer: z.string().optional(),
    model: z.string().optional(),
    temp_lower_limit: z.number().optional(),
    temp_upper_limit: z.number().optional(),
    calibration_due_date: z.string().datetime().nullable().optional(),
    last_service_date: z.string().datetime().nullable().optional(),
    next_service_date: z.string().datetime().nullable().optional(),
    status: z.enum(['active', 'maintenance', 'retired']).optional(),
  }),
});

// ============================================
// CORRECTIVE ACTIONS
// ============================================

export const createCorrectiveActionSchema = z.object({
  body: z.object({
    location_id: z.string().uuid(),
    compliance_check_id: z.string().uuid().optional(),
    temperature_log_id: z.string().uuid().optional(),
    incident_type: z.enum(['temperature_breach', 'check_failed', 'audit_finding']),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    description: z.string().min(1, 'Description is required'),
    root_cause: z.string().optional(),
    action_taken: z.string().optional(),
    preventive_measures: z.string().optional(),
    assigned_to: z.string().uuid().optional(),
    due_date: z.string().datetime().optional(),
  }),
});

export const updateCorrectiveActionSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    description: z.string().optional(),
    root_cause: z.string().optional(),
    action_taken: z.string().optional(),
    preventive_measures: z.string().optional(),
    assigned_to: z.string().uuid().nullable().optional(),
    due_date: z.string().datetime().nullable().optional(),
  }),
});

export const resolveCorrectiveActionSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    verification_notes: z.string().optional(),
  }),
});

// ============================================
// SUPPLIERS
// ============================================

export const createSupplierSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Supplier name is required'),
    contact_name: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    address: z.object({
      line1: z.string().optional(),
      line2: z.string().optional(),
      city: z.string().optional(),
      postal_code: z.string().optional(),
      country: z.string().optional(),
    }).optional(),
    certifications: z.array(z.object({
      name: z.string(),
      number: z.string().optional(),
      expiry_date: z.string().datetime().optional(),
      document_url: z.string().url().optional(),
    })).optional(),
    approved_products: z.array(z.string()).optional(),
    risk_rating: z.enum(['low', 'medium', 'high']).optional(),
  }),
});

export const updateSupplierSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    name: z.string().optional(),
    contact_name: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    address: z.object({
      line1: z.string().optional(),
      line2: z.string().optional(),
      city: z.string().optional(),
      postal_code: z.string().optional(),
      country: z.string().optional(),
    }).optional(),
    certifications: z.array(z.object({
      name: z.string(),
      number: z.string().optional(),
      expiry_date: z.string().datetime().optional(),
      document_url: z.string().url().optional(),
    })).optional(),
    approved_products: z.array(z.string()).optional(),
    risk_rating: z.enum(['low', 'medium', 'high']).optional(),
    status: z.enum(['active', 'inactive']).optional(),
  }),
});

// ============================================
// DELIVERIES
// ============================================

export const createDeliveryLogSchema = z.object({
  body: z.object({
    location_id: z.string().uuid(),
    supplier_id: z.string().uuid().optional(),
    delivery_date: z.string().datetime(),
    invoice_number: z.string().optional(),
    items: z.array(z.object({
      product: z.string(),
      quantity: z.number(),
      unit: z.string().optional(),
      batch_number: z.string().optional(),
      use_by_date: z.string().datetime().optional(),
      temp_on_arrival: z.number().optional(),
    })),
    temperature_acceptable: z.boolean(),
    packaging_acceptable: z.boolean(),
    quality_acceptable: z.boolean(),
    issues_noted: z.string().optional(),
    photos: z.array(z.string().url()).optional(),
    accepted: z.boolean(),
    rejection_reason: z.string().optional(),
  }),
});

// ============================================
// ALLERGENS
// ============================================

export const updateAllergenMatrixSchema = z.object({
  params: z.object({
    menuItemId: z.string().uuid(),
  }),
  body: z.object({
    celery: z.boolean().optional(),
    gluten: z.boolean().optional(),
    crustaceans: z.boolean().optional(),
    eggs: z.boolean().optional(),
    fish: z.boolean().optional(),
    lupin: z.boolean().optional(),
    milk: z.boolean().optional(),
    molluscs: z.boolean().optional(),
    mustard: z.boolean().optional(),
    nuts: z.boolean().optional(),
    peanuts: z.boolean().optional(),
    sesame: z.boolean().optional(),
    soya: z.boolean().optional(),
    sulphites: z.boolean().optional(),
    may_contain: z.array(z.string()).optional(),
    dietary_info: z.object({
      vegan: z.boolean().optional(),
      vegetarian: z.boolean().optional(),
      halal: z.boolean().optional(),
      kosher: z.boolean().optional(),
    }).optional(),
  }),
});

// ============================================
// TRAINING
// ============================================

export const createTrainingRecordSchema = z.object({
  body: z.object({
    user_id: z.string().uuid(),
    course_name: z.string().min(1, 'Course name is required'),
    course_type: z.enum(['food_hygiene', 'allergen', 'haccp', 'fire_safety', 'first_aid']),
    provider: z.string().optional(),
    certificate_number: z.string().optional(),
    completion_date: z.string().datetime(),
    expiry_date: z.string().datetime().optional(),
    certificate_url: z.string().url().optional(),
    score: z.number().min(0).max(100).optional(),
  }),
});

export const updateTrainingRecordSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    course_name: z.string().optional(),
    course_type: z.enum(['food_hygiene', 'allergen', 'haccp', 'fire_safety', 'first_aid']).optional(),
    provider: z.string().optional(),
    certificate_number: z.string().optional(),
    completion_date: z.string().datetime().optional(),
    expiry_date: z.string().datetime().nullable().optional(),
    certificate_url: z.string().url().nullable().optional(),
    score: z.number().min(0).max(100).optional(),
    status: z.enum(['valid', 'expiring_soon', 'expired']).optional(),
  }),
});

// ============================================
// REPORTS & DASHBOARD
// ============================================

export const complianceDashboardSchema = z.object({
  query: z.object({
    location_id: z.string().uuid().optional(),
    period: z.enum(['7d', '30d', '90d', '1y']).optional(),
  }),
});

export const exportComplianceReportSchema = z.object({
  body: z.object({
    location_id: z.string().uuid().optional(),
    start_date: z.string().datetime(),
    end_date: z.string().datetime(),
    include_checks: z.boolean().optional(),
    include_temperature: z.boolean().optional(),
    include_deliveries: z.boolean().optional(),
    include_training: z.boolean().optional(),
    format: z.enum(['pdf', 'csv', 'json']).optional(),
  }),
});
