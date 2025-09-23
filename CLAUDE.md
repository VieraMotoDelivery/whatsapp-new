# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

whatsapp-web.js is a Node.js library that provides a WhatsApp API client by controlling the WhatsApp Web browser application through Puppeteer. The library connects to WhatsApp Web's internal functions to enable programmatic interaction with WhatsApp, offering most features available on WhatsApp Web.

**Important**: This library operates by automating WhatsApp Web through browser automation. WhatsApp does not officially support bots or unofficial clients, so usage carries inherent risks of being blocked.

## Development Commands

### Testing
- `npm test` - Run all tests using Mocha with 5s timeout
- `npm run test-single` - Run a single test file with Mocha
- `mocha tests/path/to/specific.test.js` - Run specific test file

### Development
- `npm start` - Run the example.js file
- `npm run shell` - Start interactive Node.js REPL with library loaded
- `npm run generate-docs` - Generate JSDoc documentation

### Code Quality
- ESLint is configured with `.eslintrc.json` - uses 4-space indentation, single quotes, semicolons required
- Code style follows Unix line endings and ES2022 syntax

## Architecture

### Core Components

**Client (`src/Client.js`)**
- Main entry point extending EventEmitter
- Manages Puppeteer browser instance and WhatsApp Web session
- Handles authentication, message sending/receiving, and event emission
- Configurable through extensive options (puppeteer settings, auth strategies, timeouts)

**Authentication Strategies (`src/authStrategies/`)**
- `NoAuth` - No session persistence (default)
- `LocalAuth` - Local file-based session storage
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
- `Injected/` - Code injected into WhatsApp Web page
- `Puppeteer.js` - Puppeteer utilities

### Key Technical Details

**Browser Automation**
- Uses Puppeteer to control Chrome/Chromium instance
- Injects JavaScript into WhatsApp Web page to access internal APIs
- Requires careful handling of page reloads, network issues, and auth state

**Event System**
- Client emits events for: `qr`, `authenticated`, `ready`, `message`, `message_create`, etc.
- Event-driven architecture allows responsive bot development
- Events defined in `src/util/Constants.js`

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
- `fluent-ffmpeg` (2.1.3) - Video processing for stickers
- `mime` (^3.0.0) - MIME type handling
- `node-fetch` (^2.6.9) - HTTP requests

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

## Important Files

- `index.js` - Main module exports (Client class and all structures)
- `example.js` - Comprehensive usage examples
- `shell.js` - Interactive development shell
- `index.d.ts` - TypeScript definitions
- `.wwebjs_auth/` - Authentication data storage (git-ignored)
- `.wwebjs_cache/` - Web version cache (git-ignored)