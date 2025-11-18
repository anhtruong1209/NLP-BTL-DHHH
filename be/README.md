# Backend API for AI Composer

This is the backend API for the AI Composer application.

## Features

- User authentication with JWT
- Chat with AI models
- File upload and processing (images and PDFs)
- Admin panel for user management
- API key management

## PDF Processing Feature

The application now supports processing multiple PDF files with Gemini API. When users upload PDF files along with their messages, the system:

1. Reads the PDF files and converts them to base64 format
2. Sends the PDF data to Gemini API using the `fileData` parameter
3. Gemini processes the PDF content and generates a response based on both the text message and PDF content
4. The response is formatted to include information about the processed PDF files

This feature enables users to ask questions about PDF documents, extract information, summarize content, and more.

## Setup

1. Clone the repository
2. Install dependencies with `npm install`
3. Set up environment variables
4. Run the server with `npm start`

## Environment Variables

- `PORT`: Port for the server (default: 3001)
- `JWT_SECRET`: Secret for JWT tokens
- `DB_SERVER`: SQL Server hostname
- `DB_NAME`: Database name
- `DB_USER`: Database username
- `DB_PASSWORD`: Database password 