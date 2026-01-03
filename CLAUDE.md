# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

whatsapp-web.js is a Node.js library that provides a WhatsApp API client by controlling the WhatsApp Web browser application through Puppeteer. The library connects to WhatsApp Web's internal functions to enable programmatic interaction with WhatsApp, offering most features available on WhatsApp Web.

**Important**: This library operates by automating WhatsApp Web through browser automation. WhatsApp does not officially support bots or unofficial clients, so usage carries inherent risks of being blocked.

## Development Commands

### Running the Application
- `npm start` - Starts the API server (runs api-server.js via start.js)
- `npm run api` - Directly run api-server.js
- `npm run api-test` - Test API endpoints using api-example.js
- `npm run dev` - Alias for npm start
- `node example.js` - Run the comprehensive example file

### Testing
- `npm test` - Run all tests using Mocha with 5s timeout
- `npm run test-single` - Run a single test file with Mocha
- `mocha tests/path/to/specific.test.js` - Run specific test file

### Development
- `npm run shell` - Start interactive Node.js REPL with library loaded
- `npm run generate-docs` - Generate JSDoc documentation

### Code Quality
- ESLint is configured with `.eslintrc.json` - uses 4-space indentation, single quotes, semicolons required
- Code style follows Unix line endings and ES2022 syntax

## Custom API Server

This repository includes a custom Express API server implementation with Socket.IO for real-time communication:

### Core Files
- **api-server.js** - REST API server running on port 7005 with endpoints for sending messages
- **api-example.js** - Example client demonstrating how to use the API endpoints
- **start.js** - Launcher script that starts api-server.js with proper process management

### API Endpoints
- `POST /send-message` - Send message to individual contact (body: {number, message})
- `POST /send-group-message` - Send message to group by name (body: {name, message})
- `GET /status` - Check WhatsApp client status

### Custom Business Logic Modules (`src/`)
- **fisica.js** - Handles individual/physical person registration workflows
- **empresa.js** - Handles company/business registration workflows
- **clientecadastro.js** - Client registration management
- **sosregistrarcodigo.js** - Code registration utilities
- **request.js** - Axios-based API client for external database integration
- **api.js** - Axios instance configured for Railway deployment (https://db-viera.up.railway.app/)
- **middlewares.js** - Business logic middleware functions including:
  - `codigoetelefone` - Phone number and code verification
  - `checkingNumbers` - Message content validation
  - `cronJob` - Scheduled task management
  - Various CRUD operations for deliveries and client management
  - Chatbot activation/deactivation controls

### Message Processing Features
- **Duplicate Message Prevention**: Blocks messages repeated 5+ times within 5-minute window
- **Message Tracking**: Prevents processing same message ID multiple times
- **Warmup Period**: 20-second delay before bot responds to messages after initialization
- **Auto-cleanup**: Periodic cleanup of message tracking maps

## Architecture

### Core Components

**Client (`src/Client.js`)**
- Main entry point extending EventEmitter
- Manages Puppeteer browser instance and WhatsApp Web session
- Handles authentication, message sending/receiving, and event emission
- Configurable through extensive options (puppeteer settings, auth strategies, timeouts)
- Injects JavaScript into WhatsApp Web page via `src/util/Injected/` utilities

**Authentication Strategies (`src/authStrategies/`)**
- `NoAuth` - No session persistence (default)
- `LocalAuth` - Local file-based session storage (used by api-server.js)
- `RemoteAuth` - Remote session storage (for distributed systems)
- `BaseAuthStrategy` - Abstract base class

**Structures (`src/structures/`)**
- `Message`, `Chat`, `Contact`, `MessageMedia` - Core WhatsApp entities
- `GroupChat`, `PrivateChat`, `Channel` - Chat type implementations
- `Location`, `Poll`, `Buttons`, `List` - Message content types
- All extend `Base` class for common functionality

**Factories (`src/factories/`)**
- `ChatFactory` - Creates appropriate Chat instances
- `ContactFactory` - Creates Contact instances
- Handle object creation from WhatsApp Web data

**Web Cache (`src/webCache/`)**
- Manages WhatsApp Web version caching
- `LocalWebCache` - Local version storage
- `RemoteWebCache` - Remote version fetching
- `WebCacheFactory` - Factory for cache implementations

**Utilities (`src/util/`)**
- `Constants.js` - Default options, events, status codes
- `InterfaceController.js` - Browser page interaction
- `Injected/` - Code injected into WhatsApp Web page (Store.js, LegacyStore.js, Utils.js, AuthStore/)
- `Puppeteer.js` - Puppeteer utilities

**Module Exports (`index.js`)**
Exports all main classes: Client, and all structures from `src/structures/index.js`

### Key Technical Details

**Browser Automation**
- Uses Puppeteer to control Chrome/Chromium instance
- Injects JavaScript into WhatsApp Web page to access internal APIs (`@pedroslopez/moduleraid`)
- Requires careful handling of page reloads, network issues, and auth state
- Can be configured for headless or headed mode
- Supports device name and browser name customization for linked devices

**Event System**
- Client emits events for: `qr`, `authenticated`, `ready`, `message`, `message_create`, `loading_screen`, etc.
- Event-driven architecture allows responsive bot development
- Events defined in `src/util/Constants.js`
- Key events: `qr` (for QR code auth), `code` (for phone pairing), `ready` (client ready), `message` (incoming messages)

**Message Handling**
- Supports text, media (images/audio/video/documents), location, contacts
- Handles message replies, mentions, reactions
- Media requires encoding/decoding for web transmission

**Group Management**
- Full group administration: create, modify settings, add/remove participants
- Group invite link generation and joining
- Participant promotion/demotion

## Dependencies

**Core Dependencies**
- `puppeteer` (^18.2.1) - Browser automation
- `@pedroslopez/moduleraid` (^5.0.2) - WhatsApp Web module extraction
- `express` (^5.1.0) - Web server for API
- `socket.io` (^4.8.1) - Real-time bidirectional communication
- `axios` (^1.12.2) - HTTP client for external API calls
- `cron` (^4.3.3) - Scheduled task management
- `fluent-ffmpeg` (2.1.3) - Video processing for stickers
- `mime` (^3.0.0) - MIME type handling
- `node-fetch` (^2.6.9) - HTTP requests
- `qrcode` (^1.5.4) - QR code generation
- `qrcode-terminal` (^0.12.0) - QR code display in terminal

**Development Dependencies**
- `mocha` (^9.0.2) - Test framework
- `chai` (^4.3.4) + `chai-as-promised` - Assertions
- `eslint` (^8.4.1) - Linting
- `sinon` (^13.0.1) - Test mocking

**Node.js Requirements**
- Node.js v18+ required (specified in package.json engines)

## Testing Structure

Tests located in `tests/` directory:
- `client.js` - Main client functionality tests
- `structures/` - Tests for data structure classes
- `helper.js` - Test utilities and helpers
- Tests use Mocha with 5-second timeout for async operations

## Important Files & Directories

- `index.js` - Main module exports (Client class and all structures)
- `example.js` - Comprehensive usage examples showing all library features
- `api-server.js` - Custom Express REST API server implementation
- `api-example.js` - API client examples
- `start.js` - Application launcher for API server
- `shell.js` - Interactive development shell (REPL)
- `index.d.ts` - TypeScript type definitions
- `src/` - Source code directory
- `tests/` - Test suite directory
- `.wwebjs_auth/` - Authentication data storage (git-ignored)
- `.wwebjs_cache/` - WhatsApp Web version cache (git-ignored)

## Authentication Methods

The library supports two authentication methods:
1. **QR Code** - Default method, emits `qr` event with QR code string
2. **Phone Pairing** - Using `pairWithPhoneNumber` option, emits `code` event with pairing code

When using LocalAuth strategy, sessions are persisted in `.wwebjs_auth/` directory.
