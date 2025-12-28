const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// In-memory data store for appointments
let appointments = [];
let nextId = 1;

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
  res.json({ 
    message: 'Welcome to AppointmentCareApp',
    status: 'Server is running',
    endpoints: {
      'GET /api/appointments': 'Get all appointments',
      'GET /api/appointments/:id': 'Get appointment by ID',
      'POST /api/appointments': 'Create new appointment',
      'PUT /api/appointments/:id': 'Update appointment',
      'DELETE /api/appointments/:id': 'Delete appointment',
      'GET /api/health': 'Health check'
    }
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Get all appointments
app.get('/api/appointments', (req, res) => {
  res.json({
    success: true,
    count: appointments.length,
    data: appointments
  });
});

// Get appointment by ID
app.get('/api/appointments/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const appointment = appointments.find(apt => apt.id === id);
  
  if (!appointment) {
    return res.status(404).json({
      success: false,
      message: `Appointment with ID ${id} not found`
    });
  }
  
  res.json({
    success: true,
    data: appointment
  });
});

// Create new appointment
app.post('/api/appointments', (req, res) => {
  const { patientName, date, time, reason, doctor } = req.body;
  
  // Validation
  if (!patientName || !date || !time) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: patientName, date, and time are required'
    });
  }
  
  const newAppointment = {
    id: nextId++,
    patientName,
    date,
    time,
    reason: reason || 'General consultation',
    doctor: doctor || 'Dr. Smith',
    status: 'scheduled',
    createdAt: new Date().toISOString()
  };
  
  appointments.push(newAppointment);
  
  res.status(201).json({
    success: true,
    message: 'Appointment created successfully',
    data: newAppointment
  });
});

// Update appointment
app.put('/api/appointments/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const appointmentIndex = appointments.findIndex(apt => apt.id === id);
  
  if (appointmentIndex === -1) {
    return res.status(404).json({
      success: false,
      message: `Appointment with ID ${id} not found`
    });
  }
  
  const { patientName, date, time, reason, doctor, status } = req.body;
  const appointment = appointments[appointmentIndex];
  
  // Update only provided fields
  if (patientName) appointment.patientName = patientName;
  if (date) appointment.date = date;
  if (time) appointment.time = time;
  if (reason) appointment.reason = reason;
  if (doctor) appointment.doctor = doctor;
  if (status) appointment.status = status;
  appointment.updatedAt = new Date().toISOString();
  
  res.json({
    success: true,
    message: 'Appointment updated successfully',
    data: appointment
  });
});

// Delete appointment
app.delete('/api/appointments/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const appointmentIndex = appointments.findIndex(apt => apt.id === id);
  
  if (appointmentIndex === -1) {
    return res.status(404).json({
      success: false,
      message: `Appointment with ID ${id} not found`
    });
  }
  
  const deletedAppointment = appointments.splice(appointmentIndex, 1)[0];
  
  res.json({
    success: true,
    message: 'Appointment deleted successfully',
    data: deletedAppointment
  });
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

// Start server
app.listen(PORT, () => {
  console.log(`AppointmentCareApp server is running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to see available endpoints`);
});

