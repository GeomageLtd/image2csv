# Image2CSV - AI-Powered Image to CSV Converter

A modern web application that converts images containing tables, forms, and structured data into editable CSV files using AI-powered OCR technology.

## 🚀 Features

### Core Functionality
- **AI-Powered OCR**: Convert images to structured CSV data using advanced image recognition
- **Multiple Image Formats**: Support for JPG, PNG, TIFF, and other common image formats
- **TIFF Multi-Page Processing**: Extract and process individual pages from multi-page TIFF documents
- **Batch Processing**: Upload and process multiple images simultaneously
- **Real-time Progress**: Live progress tracking for batch operations

### User Interface
- **Horizontal Image Gallery**: View uploaded images in a scrollable horizontal layout
- **In-Place Image Viewer**: Click images to expand within the interface (no full-screen overlay)
- **Interactive Table Editor**: Edit CSV data directly in the browser with validation
- **Image Cropping**: Full-screen crop tool with zoom and pan capabilities
- **Responsive Design**: Mobile-optimized interface that works on all devices

### Data Management
- **CSV Validation**: Comprehensive data validation with error highlighting
- **Table Editing**: Click-to-edit cells with real-time validation
- **Data Export**: Download processed CSV files
- **Results History**: Save and reload previous processing results
- **Share Functionality**: Generate shareable links for results

## 📋 Requirements

- **Node.js**: Version 14 or higher
- **NPM**: Package manager for dependencies
- **Modern Browser**: Chrome, Firefox, Safari, or Edge

## 🛠 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd image2csv/webapp
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the application**
   ```bash
   node server.js
   ```

4. **Access the application**
   ```
   http://localhost:3000
   ```

## 🏗 Architecture

This application has been completely refactored from a monolithic structure into a modular, maintainable architecture.

### Backend Structure
```
src/
├── config/
│   └── constants.js         # Application configuration
├── middleware/
│   ├── multerConfig.js      # File upload handling
│   └── errorHandler.js      # Error management
├── routes/
│   ├── api.js               # API endpoints
│   └── static.js            # Static page routes
├── services/
│   └── resultService.js     # Business logic
└── utils/
    └── fileUtils.js         # File operations

server.js                    # Main server (74 lines)
```

### Frontend Structure
```
public/js/
├── config.js               # Application state management
├── utils.js                # Shared utility functions
├── fileManager.js          # File handling and TIFF processing
├── cropManager.js          # Image cropping functionality
├── tableEditor.js          # CSV editing and validation
└── main.js                 # Application coordination

public/css/
├── base.css               # Core styles and layout
├── forms.css              # Form and input styling
├── gallery.css            # Image gallery and viewer
├── table.css              # CSV table and editor
├── modals.css             # Modal components
└── responsive.css         # Mobile optimizations
```

## 🎯 Usage

### Basic Workflow
1. **Upload Images**: Select one or more images containing tabular data
2. **Preview Images**: Review uploaded images in the horizontal gallery
3. **Process Images**: Click "Process Images" to extract CSV data
4. **Edit Data**: Use the interactive table editor to refine results
5. **Export CSV**: Download the processed data as CSV files

### Advanced Features
- **Image Cropping**: Click "Crop" on any image to select specific areas
- **TIFF Pages**: Multi-page TIFF files are automatically split into individual pages
- **Data Validation**: Red highlights indicate data quality issues with suggested fixes
- **Batch Operations**: Process multiple images with combined CSV output

## 🔧 Development

### Code Organization
The application follows a modular architecture with clear separation of concerns:

- **Backend**: Express.js server with middleware, routes, and services
- **Frontend**: Vanilla JavaScript with feature-based modules
- **Styling**: Component-based CSS with responsive design
- **Assets**: Organized in logical directory structure

### Key Design Decisions
- **No Framework Dependencies**: Uses vanilla JavaScript for maximum control
- **Modular CSS**: Organized into feature-specific stylesheets
- **Responsive First**: Mobile-optimized throughout
- **Progressive Enhancement**: Works without JavaScript for basic functionality

### File Size Optimization
- **Server**: Reduced from 424 to 74 lines (82% reduction)
- **Frontend**: Organized from 3,488 lines into 6 focused modules
- **CSS**: Split from 2,024 lines into 6 component-based files

## 🎨 UI/UX Features

### Image Gallery
- **Horizontal Layout**: Images display in a scrollable row
- **In-Place Viewer**: Click to expand images within the left column
- **Navigation Controls**: Previous/next buttons with keyboard support
- **Responsive Grid**: Adapts to screen size automatically

### Table Editor
- **Click-to-Edit**: Click any cell to edit data directly
- **Data Validation**: Real-time validation with visual feedback
- **Bulk Operations**: Add/remove rows and columns
- **Export Options**: Multiple CSV format options

### Mobile Experience
- **Touch-Friendly**: Large touch targets and gesture support
- **Responsive Layout**: Single-column layout on mobile devices
- **Optimized Performance**: Reduced animations and optimized rendering

## 🔍 Technical Details

### Performance
- **Lazy Loading**: Images load on demand
- **Efficient Rendering**: Virtualized table rows for large datasets
- **Optimized Assets**: Minified CSS and optimized images
- **Caching**: Browser caching for static assets

### Browser Support
- **Modern Browsers**: Chrome 80+, Firefox 75+, Safari 13+, Edge 80+
- **Progressive Enhancement**: Graceful degradation for older browsers
- **Mobile Browsers**: Full support for iOS Safari and Android Chrome

### Security
- **File Validation**: Server-side file type and size validation
- **Input Sanitization**: All user inputs are sanitized
- **CORS Protection**: Configured for secure cross-origin requests
- **Error Handling**: Comprehensive error handling and logging

## 📊 Performance Metrics

| Metric | Before Refactoring | After Refactoring | Improvement |
|--------|-------------------|-------------------|-------------|
| Server Code | 424 lines | 74 lines | 82% reduction |
| Frontend Modules | 1 monolithic file | 6 focused modules | Organized |
| CSS Files | 1 large file | 6 component files | Modular |
| Maintainability | Low | High | Significantly improved |
| Team Development | Difficult | Easy | Multiple developers |

## 🚀 Future Enhancements

### Planned Features
- **Cloud Storage Integration**: Direct upload to cloud services
- **Additional OCR Engines**: Multiple AI providers for better accuracy
- **Real-time Collaboration**: Multi-user editing capabilities
- **Advanced Export Formats**: Excel, JSON, and custom formats
- **API Integration**: RESTful API for programmatic access

### Technical Improvements
- **Progressive Web App**: Offline functionality and app-like experience
- **Build Pipeline**: Automated minification and optimization
- **Testing Suite**: Comprehensive unit and integration tests
- **Docker Support**: Containerized deployment options

## 📄 License

This project is available under the MIT License. See LICENSE file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues for bugs and feature requests.

### Development Setup
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📞 Support

For questions, issues, or support, please open an issue on the project repository.

---

**Image2CSV** - Converting images to structured data with AI-powered precision. 