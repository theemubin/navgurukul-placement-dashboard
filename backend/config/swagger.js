const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Placement Dashboard API',
      version: '1.0.0',
      description: 'API documentation for the Navgurukul Placement Management System',
      contact: {
        name: 'API Support',
        url: 'https://navgurukul.org',
      },
    },
    servers: [
      {
        url: '/',
        description: 'Current Host (Recommended)',
      },
      {
        url: 'http://localhost:5001',
        description: 'Local Development Server',
      },
      {
        url: 'https://navgurukul-placement-dashboard.onrender.com',
        description: 'Production API Server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  // Path to the API docs
  apis: ['./routes/*.js', './models/*.js'], 
};

const specs = swaggerJsdoc(options);

module.exports = specs;
