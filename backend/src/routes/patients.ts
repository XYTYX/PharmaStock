import express from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { requireRole } from '../middleware/auth';

const router = express.Router();

// Utility function to format names (trim whitespace and capitalize first letter of each word)
const formatName = (name: string): string => {
  return name
    .trim()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

const createPatientSchema = z.object({
  patientName: z.string().min(1, 'Patient name is required'),
  patientId: z.string().min(1, 'Patient ID is required')
});

const updatePatientSchema = createPatientSchema.partial();

// Get all patients
router.get('/', async (req, res) => {
  try {
    const { page = '1', limit = '50', search } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (search) {
      where.OR = [
        { patientName: { contains: search as string, mode: 'insensitive' } },
        { patientId: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    const [patients, total] = await Promise.all([
      prisma.patient.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { patientName: 'asc' },
        include: {
          inventoryLogs: {
            select: {
              id: true,
              createdAt: true,
              reason: true,
              totalAmount: true,
              item: {
                select: {
                  name: true,
                  form: true
                }
              }
            },
            orderBy: { createdAt: 'desc' },
            take: 5 // Get last 5 dispensations
          }
        }
      }),
      prisma.patient.count({ where })
    ]);

    res.json({
      patients,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching patients:', error);
    res.status(500).json({ error: 'Failed to fetch patients' });
  }
});

// Get patient by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const patient = await prisma.patient.findUnique({
      where: { id },
      include: {
        inventoryLogs: {
          include: {
            item: {
              select: {
                name: true,
                form: true,
                expiryDate: true
              }
            },
            user: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    res.json({ patient });
  } catch (error) {
    console.error('Error fetching patient:', error);
    res.status(500).json({ error: 'Failed to fetch patient' });
  }
});

// Create new patient
router.post('/', async (req, res) => {
  try {
    const { patientName, patientId } = createPatientSchema.parse(req.body);
    
    // Check if patient with this ID already exists
    const existingPatient = await prisma.patient.findFirst({
      where: { patientId }
    });

    if (existingPatient) {
      return res.status(409).json({ error: 'Patient with this ID already exists' });
    }

    // Format the patient name
    const formattedPatientName = formatName(patientName);

    const patient = await prisma.patient.create({
      data: {
        patientName: formattedPatientName,
        patientId
      }
    });

    res.status(201).json({ patient });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error creating patient:', error);
    res.status(500).json({ error: 'Failed to create patient' });
  }
});

// Update patient
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = updatePatientSchema.parse(req.body);

    // Format patient name if provided
    if (updateData.patientName) {
      updateData.patientName = formatName(updateData.patientName);
    }

    // Check if patient exists
    const existingPatient = await prisma.patient.findUnique({
      where: { id }
    });

    if (!existingPatient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Check if new patient ID conflicts with existing patient
    if (updateData.patientId && updateData.patientId !== existingPatient.patientId) {
      const conflictingPatient = await prisma.patient.findFirst({
        where: { 
          patientId: updateData.patientId,
          id: { not: id }
        }
      });

      if (conflictingPatient) {
        return res.status(409).json({ error: 'Patient with this ID already exists' });
      }
    }

    const patient = await prisma.patient.update({
      where: { id },
      data: updateData
    });

    res.json({ patient });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error updating patient:', error);
    res.status(500).json({ error: 'Failed to update patient' });
  }
});

// Delete patient
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if patient exists
    const existingPatient = await prisma.patient.findUnique({
      where: { id }
    });

    if (!existingPatient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Check if patient has any inventory logs
    const logCount = await prisma.inventoryLog.count({
      where: { patientId: id }
    });

    if (logCount > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete patient with existing inventory logs',
        logCount 
      });
    }

    await prisma.patient.delete({
      where: { id }
    });

    res.json({ message: 'Patient deleted successfully' });
  } catch (error) {
    console.error('Error deleting patient:', error);
    res.status(500).json({ error: 'Failed to delete patient' });
  }
});

// Find or create patient (utility endpoint for dispensations)
router.post('/find-or-create', async (req, res) => {
  try {
    const { patientName, patientId } = createPatientSchema.parse(req.body);
    
    // Format the patient name
    const formattedPatientName = formatName(patientName);

    // Try to find existing patient by patientId
    let patient = await prisma.patient.findFirst({
      where: { patientId }
    });

    if (patient) {
      // Update patient name if it has changed
      if (patient.patientName !== formattedPatientName) {
        patient = await prisma.patient.update({
          where: { id: patient.id },
          data: { patientName: formattedPatientName }
        });
      }
    } else {
      // Create new patient
      patient = await prisma.patient.create({
        data: {
          patientName: formattedPatientName,
          patientId
        }
      });
    }

    res.json({ patient });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error finding or creating patient:', error);
    res.status(500).json({ error: 'Failed to find or create patient' });
  }
});

export default router;
