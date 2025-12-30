const express = require('express');
const mysql = require('mysql2/promise');
const app = express();
const PORT = process.env.PORT || 3000;

// MySQL Database Configuration
const dbConfig = {
  host: 'localhost',
  port: 3306,
  user: 'admin',
  password: 'password',
  database: 'appointmentcare'
};

// Create MySQL connection pool
let pool;

// Initialize database connection
async function initDatabase() {
  try {
    pool = mysql.createPool({
      ...dbConfig,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
    
    // Test connection
    const connection = await pool.getConnection();
    console.log('Connected to MySQL database successfully');
    connection.release();
  } catch (error) {
    console.error('Error connecting to MySQL database:', error.message);
    process.exit(1);
  }
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Root route
app.get('/', (req, res) => {
  /*res.json({ 
    message: 'Bem vindo ao AppointmentCareApp',
    status: 'Server is running',
    database: 'Connected to MySQL (appointmentcare)',
    endpoints: {
      'GET /api/appointments': 'Get all appointments',
      'GET /api/appointments/:id': 'Get appointment by ID',
      'POST /api/appointments': 'Create new appointment',
      'PUT /api/appointments/:id': 'Update appointment',
      'DELETE /api/appointments/:id': 'Delete appointment',
      'GET /api/doctors': 'Get all doctors',
      'GET /api/doctors/:id': 'Get doctor by ID',
      'GET /api/pacients': 'Get all pacients',
      'GET /api/pacients/:id': 'Get pacient by ID',
      'GET /api/specialities': 'Get all specialities',
      'GET /api/specialities/:id': 'Get speciality by ID',
      'GET /api/genres': 'Get all genres',
      'GET /api/genres/:id': 'Get genre by ID',
      'GET /api/neighbourhoods': 'Get all neighbourhoods',
      'GET /api/neighbourhoods/:id': 'Get neighbourhood by ID',
      'GET /api/health': 'Health check'
    }
  });*/
  res.sendFile(__dirname + '/index.html');
});

// Home
app.get('/home', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// Tabela Admin
app.get('/dashboard', (req, res) => {
  res.sendFile(__dirname + '/dashboard.html');
});

// criar consulta
app.get('/insert', (req, res) => {
  res.sendFile(__dirname + '/insert.html');
});

// Login
app.get('/login', (req, res) => {
  res.sendFile(__dirname + '/login.html');
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    
    res.json({ 
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message
    });
  }
});

// ==================== APPOINTMENT ENDPOINTS ====================

// Get appointment by ID
app.get('/api/appointments/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    // Validate ID
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid appointment ID. Must be a positive integer.'
      });
    }
    
    const [rows] = await pool.execute(
      'SELECT * FROM appointment WHERE id_appointment = ?',
      [id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Appointment with ID ${id} not found`
      });
    }
    
    res.json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error('Error fetching appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching appointment',
      error: error.message
    });
  }
});

app.get('/api/appointments', async (req, res) => {
  try {
    // A query SQL faz a ligação entre as 4 tabelas
    const query = `
      SELECT 
        a.id_appointment,
        a.appointment_date,
        a.scheduled_date,
        a.status,
        a.sms_sent,
        p.name AS pacient_name,
        d.name AS doctor_name,
        s.name AS speciality_name
      FROM appointment a
      LEFT JOIN pacient p ON a.pacient_id = p.id_pacient
      LEFT JOIN doctor d ON a.doctor_id = d.id_doctor
      LEFT JOIN speciality s ON d.speciality_id = s.id_speciality
      ORDER BY a.appointment_date DESC
    `;

    const [rows] = await pool.execute(query);
    
    // Enviamos apenas o array de linhas (rows) para facilitar a leitura no frontend
    res.json(rows); 

  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching appointments',
      error: error.message
    });
  }
});

// Create new appointment
app.post('/api/appointments', async (req, res) => {
  try {
    const { pacient_id, doctor_id, appointment_date, scheduled_date, status, sms_sent } = req.body;
    
    // Validation: status is required and must be valid
    const validStatuses = ['scheduled', 'done', 'cancelled', 'no_show'];
    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }
    
    // Validate pacient_id if provided
    if (pacient_id !== undefined && pacient_id !== null) {
      const pacientId = parseInt(pacient_id);
      if (isNaN(pacientId) || pacientId <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid pacient_id. Must be a positive integer.'
        });
      }
      
      // Check if pacient exists
      const [pacientRows] = await pool.execute(
        'SELECT id_pacient FROM pacient WHERE id_pacient = ?',
        [pacientId]
      );
      
      if (pacientRows.length === 0) {
        return res.status(404).json({
          success: false,
          message: `Pacient with ID ${pacientId} not found`
        });
      }
    }
    
    // Validate doctor_id if provided
    if (doctor_id !== undefined && doctor_id !== null) {
      const doctorId = parseInt(doctor_id);
      if (isNaN(doctorId) || doctorId <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid doctor_id. Must be a positive integer.'
        });
      }
      
      // Check if doctor exists
      const [doctorRows] = await pool.execute(
        'SELECT id_doctor FROM doctor WHERE id_doctor = ?',
        [doctorId]
      );
      
      if (doctorRows.length === 0) {
        return res.status(404).json({
          success: false,
          message: `Doctor with ID ${doctorId} not found`
        });
      }
    }
    
    // Validate date formats if provided
    if (appointment_date && !isValidDateTime(appointment_date)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid appointment_date format. Use YYYY-MM-DD HH:MM:SS or ISO 8601 format.'
      });
    }
    
    if (scheduled_date && !isValidDateTime(scheduled_date)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid scheduled_date format. Use YYYY-MM-DD HH:MM:SS or ISO 8601 format.'
      });
    }
    
    // Validate sms_sent if provided
    if (sms_sent !== undefined && sms_sent !== null && typeof sms_sent !== 'boolean' && sms_sent !== 0 && sms_sent !== 1) {
      return res.status(400).json({
        success: false,
        message: 'Invalid sms_sent. Must be a boolean (true/false) or 0/1.'
      });
    }
    
    // Check for appointment conflicts (20-minute gap required)
    if (doctor_id && scheduled_date) {
      const scheduledDateTime = new Date(scheduled_date);
      
      // Calculate 20 minutes before and after (exclusive boundaries)
      const twentyMinutesBefore = new Date(scheduledDateTime.getTime() - 20 * 60 * 1000);
      const twentyMinutesAfter = new Date(scheduledDateTime.getTime() + 20 * 60 * 1000);
      
      // Check for conflicting appointments (excluding cancelled ones)
      // Conflict exists if there's an appointment within 20 minutes (but not exactly 20 minutes)
      // So we check: existing_time > (new_time - 20min) AND existing_time < (new_time + 20min)
      const [conflictingAppointments] = await pool.execute(
        `SELECT id_appointment, scheduled_date, status 
         FROM appointment 
         WHERE doctor_id = ? 
         AND scheduled_date IS NOT NULL
         AND status != 'cancelled'
         AND scheduled_date > ? 
         AND scheduled_date < ?`,
        [
          doctor_id,
          twentyMinutesBefore.toISOString().slice(0, 19).replace('T', ' '),
          twentyMinutesAfter.toISOString().slice(0, 19).replace('T', ' ')
        ]
      );
      
      if (conflictingAppointments.length > 0) {
        const conflict = conflictingAppointments[0];
        const conflictTime = new Date(conflict.scheduled_date);
        const conflictTimeStr = conflictTime.toLocaleString();
        const requestedTimeStr = scheduledDateTime.toLocaleString();
        
        return res.status(409).json({
          success: false,
          message: `Doctor already has an appointment scheduled at ${conflictTimeStr}. Appointments must be at least 20 minutes apart. Your requested time ${requestedTimeStr} is too close.`,
          conflict: {
            appointment_id: conflict.id_appointment,
            scheduled_date: conflict.scheduled_date,
            requested_date: scheduled_date
          }
        });
      }
    }
    
    // Insert appointment
    const [result] = await pool.execute(
      `INSERT INTO appointment (pacient_id, doctor_id, appointment_date, scheduled_date, status, sms_sent) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        pacient_id || null,
        doctor_id || null,
        appointment_date || null,
        scheduled_date || null,
        status,
        sms_sent !== undefined ? (sms_sent ? 1 : 0) : null
      ]
    );
    
    // Fetch the created appointment
    const [newAppointment] = await pool.execute(
      'SELECT * FROM appointment WHERE id_appointment = ?',
      [result.insertId]
    );
    
    res.status(201).json({
      success: true,
      message: 'Appointment created successfully',
      data: newAppointment[0]
    });
  } catch (error) {
    console.error('Error creating appointment:', error);
    
    // Handle foreign key constraint errors
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({
        success: false,
        message: 'Invalid foreign key reference. Pacient or doctor does not exist.'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error creating appointment',
      error: error.message
    });
  }
});

// Update appointment
app.put('/api/appointments/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    // Validate ID
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid appointment ID. Must be a positive integer.'
      });
    }
    
    // Check if appointment exists
    const [existingRows] = await pool.execute(
      'SELECT * FROM appointment WHERE id_appointment = ?',
      [id]
    );
    
    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Appointment with ID ${id} not found`
      });
    }
    
    const { pacient_id, doctor_id, appointment_date, scheduled_date, status, sms_sent } = req.body;
    
    // Build update query dynamically based on provided fields
    const updates = [];
    const values = [];
    
    // Validate and add status if provided
    if (status !== undefined) {
      const validStatuses = ['scheduled', 'done', 'cancelled', 'no_show'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        });
      }
      updates.push('status = ?');
      values.push(status);
    }
    
    // Validate and add pacient_id if provided
    if (pacient_id !== undefined && pacient_id !== null) {
      const pacientId = parseInt(pacient_id);
      if (isNaN(pacientId) || pacientId <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid pacient_id. Must be a positive integer.'
        });
      }
      
      // Check if pacient exists
      const [pacientRows] = await pool.execute(
        'SELECT id_pacient FROM pacient WHERE id_pacient = ?',
        [pacientId]
      );
      
      if (pacientRows.length === 0) {
        return res.status(404).json({
          success: false,
          message: `Pacient with ID ${pacientId} not found`
        });
      }
      
      updates.push('pacient_id = ?');
      values.push(pacientId);
    } else if (pacient_id === null) {
      updates.push('pacient_id = ?');
      values.push(null);
    }
    
    // Validate and add doctor_id if provided
    if (doctor_id !== undefined && doctor_id !== null) {
      const doctorId = parseInt(doctor_id);
      if (isNaN(doctorId) || doctorId <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid doctor_id. Must be a positive integer.'
        });
      }
      
      // Check if doctor exists
      const [doctorRows] = await pool.execute(
        'SELECT id_doctor FROM doctor WHERE id_doctor = ?',
        [doctorId]
      );
      
      if (doctorRows.length === 0) {
        return res.status(404).json({
          success: false,
          message: `Doctor with ID ${doctorId} not found`
        });
      }
      
      updates.push('doctor_id = ?');
      values.push(doctorId);
    } else if (doctor_id === null) {
      updates.push('doctor_id = ?');
      values.push(null);
    }
    
    // Validate and add appointment_date if provided
    if (appointment_date !== undefined) {
      if (appointment_date !== null && !isValidDateTime(appointment_date)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid appointment_date format. Use YYYY-MM-DD HH:MM:SS or ISO 8601 format.'
        });
      }
      updates.push('appointment_date = ?');
      values.push(appointment_date || null);
    }
    
    // Validate and add scheduled_date if provided
    if (scheduled_date !== undefined) {
      if (scheduled_date !== null && !isValidDateTime(scheduled_date)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid scheduled_date format. Use YYYY-MM-DD HH:MM:SS or ISO 8601 format.'
        });
      }
      updates.push('scheduled_date = ?');
      values.push(scheduled_date || null);
    }
    
    // Validate and add sms_sent if provided
    if (sms_sent !== undefined) {
      if (sms_sent !== null && typeof sms_sent !== 'boolean' && sms_sent !== 0 && sms_sent !== 1) {
        return res.status(400).json({
          success: false,
          message: 'Invalid sms_sent. Must be a boolean (true/false) or 0/1.'
        });
      }
      updates.push('sms_sent = ?');
      values.push(sms_sent !== null ? (sms_sent ? 1 : 0) : null);
    }
    
    // Check if there are any updates
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields provided to update'
      });
    }
    
    // Check for appointment conflicts (20-minute gap required)
    // Determine the doctor_id and scheduled_date to check
    const checkDoctorId = doctor_id !== undefined ? (doctor_id || existingRows[0].doctor_id) : existingRows[0].doctor_id;
    const checkScheduledDate = scheduled_date !== undefined ? (scheduled_date || existingRows[0].scheduled_date) : existingRows[0].scheduled_date;
    
    // Only check conflicts if both doctor_id and scheduled_date are present
    if (checkDoctorId && checkScheduledDate) {
      const scheduledDateTime = new Date(checkScheduledDate);
      
      // Calculate 20 minutes before and after (exclusive boundaries)
      const twentyMinutesBefore = new Date(scheduledDateTime.getTime() - 20 * 60 * 1000);
      const twentyMinutesAfter = new Date(scheduledDateTime.getTime() + 20 * 60 * 1000);
      
      // Check for conflicting appointments (excluding cancelled ones and the current appointment)
      // Conflict exists if there's an appointment within 20 minutes (but not exactly 20 minutes)
      const [conflictingAppointments] = await pool.execute(
        `SELECT id_appointment, scheduled_date, status 
         FROM appointment 
         WHERE doctor_id = ? 
         AND id_appointment != ?
         AND scheduled_date IS NOT NULL
         AND status != 'cancelled'
         AND scheduled_date > ? 
         AND scheduled_date < ?`,
        [
          checkDoctorId,
          id,
          twentyMinutesBefore.toISOString().slice(0, 19).replace('T', ' '),
          twentyMinutesAfter.toISOString().slice(0, 19).replace('T', ' ')
        ]
      );
      
      if (conflictingAppointments.length > 0) {
        const conflict = conflictingAppointments[0];
        const conflictTime = new Date(conflict.scheduled_date);
        const conflictTimeStr = conflictTime.toLocaleString();
        const requestedTimeStr = scheduledDateTime.toLocaleString();
        
        return res.status(409).json({
          success: false,
          message: `Doctor already has an appointment scheduled at ${conflictTimeStr}. Appointments must be at least 20 minutes apart. Your requested time ${requestedTimeStr} is too close.`,
          conflict: {
            appointment_id: conflict.id_appointment,
            scheduled_date: conflict.scheduled_date,
            requested_date: checkScheduledDate
          }
        });
      }
    }
    
    // Add ID to values for WHERE clause
    values.push(id);
    
    // Update appointment
    await pool.execute(
      `UPDATE appointment SET ${updates.join(', ')} WHERE id_appointment = ?`,
      values
    );
    
    // Fetch updated appointment
    const [updatedRows] = await pool.execute(
      'SELECT * FROM appointment WHERE id_appointment = ?',
      [id]
    );
    
    res.json({
      success: true,
      message: 'Appointment updated successfully',
      data: updatedRows[0]
    });
  } catch (error) {
    console.error('Error updating appointment:', error);
    
    // Handle foreign key constraint errors
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({
        success: false,
        message: 'Invalid foreign key reference. Pacient or doctor does not exist.'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error updating appointment',
      error: error.message
    });
  }
});

// Delete appointment
app.delete('/api/appointments/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    // Validate ID
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid appointment ID. Must be a positive integer.'
      });
    }
    
    // Check if appointment exists
    const [existingRows] = await pool.execute(
      'SELECT * FROM appointment WHERE id_appointment = ?',
      [id]
    );
    
    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Appointment with ID ${id} not found`
      });
    }
    
    // Delete appointment
    await pool.execute(
      'DELETE FROM appointment WHERE id_appointment = ?',
      [id]
    );
    
    res.json({
      success: true,
      message: 'Appointment deleted successfully',
      data: existingRows[0]
    });
  } catch (error) {
    console.error('Error deleting appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting appointment',
      error: error.message
    });
  }
});

// Helper function to validate datetime
function isValidDateTime(dateString) {
  if (!dateString) return false;
  
  // Try to parse as Date
  const date = new Date(dateString);
  
  // Check if it's a valid date
  if (isNaN(date.getTime())) {
    return false;
  }
  
  // Check if it matches common datetime formats
  const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
  const mysqlRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/;
  const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;
  
  return isoRegex.test(dateString) || mysqlRegex.test(dateString) || dateOnlyRegex.test(dateString);
}

// ==================== DOCTOR ENDPOINTS ====================

// Get all doctors
app.get('/api/doctors', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM doctor');
    res.json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    console.error('Error fetching doctors:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching doctors',
      error: error.message
    });
  }
});

// Get doctor by ID
app.get('/api/doctors/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    // Validate ID
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid doctor ID. Must be a positive integer.'
      });
    }
    
    const [rows] = await pool.execute(
      'SELECT * FROM doctor WHERE id_doctor = ?',
      [id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Doctor with ID ${id} not found`
      });
    }
    
    res.json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error('Error fetching doctor:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching doctor',
      error: error.message
    });
  }
});

// ==================== PACIENT ENDPOINTS ====================

// Get all pacients
app.get('/api/pacients', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM pacient');
    res.json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    console.error('Error fetching pacients:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching pacients',
      error: error.message
    });
  }
});

// Get pacient by ID
app.get('/api/pacients/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    // Validate ID
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid pacient ID. Must be a positive integer.'
      });
    }
    
    const [rows] = await pool.execute(
      'SELECT * FROM pacient WHERE id_pacient = ?',
      [id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Pacient with ID ${id} not found`
      });
    }
    
    res.json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error('Error fetching pacient:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching pacient',
      error: error.message
    });
  }
});

// ==================== SPECIALITY ENDPOINTS ====================

// Get all specialities
app.get('/api/specialities', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM speciality');
    res.json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    console.error('Error fetching specialities:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching specialities',
      error: error.message
    });
  }
});

// Get speciality by ID
app.get('/api/specialities/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    // Validate ID
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid speciality ID. Must be a positive integer.'
      });
    }
    
    const [rows] = await pool.execute(
      'SELECT * FROM speciality WHERE id_speciality = ?',
      [id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Speciality with ID ${id} not found`
      });
    }
    
    res.json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error('Error fetching speciality:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching speciality',
      error: error.message
    });
  }
});

// ==================== GENRE ENDPOINTS ====================

// Get all genres
app.get('/api/genres', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM genre');
    res.json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    console.error('Error fetching genres:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching genres',
      error: error.message
    });
  }
});

// Get genre by ID
app.get('/api/genres/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    // Validate ID
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid genre ID. Must be a positive integer.'
      });
    }
    
    const [rows] = await pool.execute(
      'SELECT * FROM genre WHERE id_genre = ?',
      [id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Genre with ID ${id} not found`
      });
    }
    
    res.json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error('Error fetching genre:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching genre',
      error: error.message
    });
  }
});

// ==================== NEIGHBOURHOOD ENDPOINTS ====================

// Get all neighbourhoods
app.get('/api/neighbourhoods', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM neighbourhood');
    res.json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    console.error('Error fetching neighbourhoods:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching neighbourhoods',
      error: error.message
    });
  }
});

// Get neighbourhood by ID
app.get('/api/neighbourhoods/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    // Validate ID
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid neighbourhood ID. Must be a positive integer.'
      });
    }
    
    const [rows] = await pool.execute(
      'SELECT * FROM neighbourhood WHERE id_neighbourhood = ?',
      [id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Neighbourhood with ID ${id} not found`
      });
    }
    
    res.json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error('Error fetching neighbourhood:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching neighbourhood',
      error: error.message
    });
  }
});

// 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Initialize database and start server
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`AppointmentCareApp server is running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT} to see available endpoints`);
    console.log(`Database: MySQL on localhost:${dbConfig.port}`);
  });
}).catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
