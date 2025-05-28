# Image to CSV Parser with Result Saving

A web application that uses OpenAI's GPT-4 Vision API to parse images containing tabular data and convert them to CSV format, with the ability to save and share results.

## Features

- **Image Upload & Processing**: Upload images with tables/data and get CSV output
- **AI-Powered Parsing**: Uses OpenAI GPT-4 Vision for accurate data extraction
- **Result Persistence**: Save results on the server for future access
- **Shareable Links**: Generate unique URLs to share results with others
- **Results History**: View and access previously processed results
- **Download CSV**: Export parsed data as CSV files
- **Responsive Design**: Works on desktop and mobile devices
- **Side-by-Side View**: Image and parsed table displayed simultaneously

## Project Structure

```
image-csv-parser/
├── server.js              # Express.js backend server
├── package.json            # Node.js dependencies
├── README.md              # This file
├── public/                # Static files served by Express
│   ├── index.html         # Main application page
│   ├── result.html        # Shared result viewer page
│   ├── styles.css         # Application styles
│   └── script.js          # Client-side JavaScript
└── data/                  # Server data storage (created automatically)
    ├── images/            # Stored uploaded images
    ├── csv/               # Stored CSV files
    └── results.json       # Results metadata
```

## Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- OpenAI API key

### Installation Steps

1. **Clone or download the project files**

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create the public directory and move files**
   ```bash
   mkdir public
   # Move index.html, result.html, styles.css, and script.js to the public/ directory
   ```

4. **Start the server**
   ```bash
   npm start
   ```
   
   For development with auto-restart:
   ```bash
   npm run dev
   ```

5. **Access the application**
   - Open your browser and go to `http://localhost:3000`
   - Enter your OpenAI API key when prompted

## How to Use

### Processing Images
1. **Enter API Key**: Input your OpenAI API key in the designated field
2. **Upload Image**: Select an image file containing tabular data
3. **Write Prompt**: Describe what you want extracted (e.g., "Parse this table and return as CSV")
4. **Process**: Click "Process Image" and wait for the AI to analyze
5. **View Results**: See the original image on the left and parsed CSV table on the right

### Managing Results
- **Auto-Save**: Results are automatically saved to the server
- **View History**: Previously processed results appear in the "Saved Results" section
- **Share Results**: Copy the generated link to share results with others
- **Download CSV**: Export the parsed data as a CSV file
- **Delete Results**: Remove unwanted results from the server

### Accessing Shared Results
- Use the shared URL to view results without needing to reprocess
- Shared results show the original image, parsed data, and processing metadata

## API Endpoints

The server provides several REST API endpoints:

- `POST /api/save-result` - Save a new processing result
- `GET /api/result/:id` - Retrieve a specific result
- `GET /api/results` - Get list of all saved results
- `DELETE /api/result/:id` - Delete a specific result
- `GET /api/health` - Server health check

## Configuration

### Environment Variables
- `PORT` - Server port (default: 3000)

### File Storage
- Images are stored in `data/images/`
- CSV files are stored in `data/csv/`
- Metadata is stored in `data/results.json`

## Security Considerations

- API keys are handled client-side only
- File uploads are limited to 10MB
- Results are stored with UUID identifiers
- No authentication system (consider adding for production use)

## Development

### Adding Features
- Modify `server.js` for backend changes
- Update `public/script.js` for client-side functionality
- Adjust `public/styles.css` for styling changes

### Database Integration
For production use, consider replacing the JSON file storage with a proper database:
- Replace `resultsStorage` object with database queries
- Update file paths to use cloud storage (AWS S3, etc.)
- Add user authentication and authorization

## Dependencies

### Backend (Node.js)
- `express` - Web framework
- `multer` - File upload handling
- `uuid` - Unique ID generation
- `cors` - Cross-origin resource sharing

### Frontend
- Vanilla JavaScript (no frameworks)
- Modern CSS with Grid and Flexbox
- Responsive design principles

## Troubleshooting

### Common Issues
- **"Result not found"**: The result may have been deleted or the URL is incorrect
- **API errors**: Check your OpenAI API key and account limits
- **File upload failures**: Ensure images are under 10MB
- **Server won't start**: Check if port 3000 is available

### Server Logs
Monitor the console output for debugging information and error messages.

## License

MIT License - Feel free to modify and distribute as needed.