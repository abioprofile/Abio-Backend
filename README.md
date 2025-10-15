# Uphold Backend

A Node.js backend application built with Express, TypeScript, and Prisma.

## Features

- User authentication with JWT
- Profile management with onboarding
- Accountability partner system
- Phone number validation
- Password complexity validation

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT
- **Validation**: Zod
- **Password Hashing**: bcryptjs

## Prerequisites

- Node.js 18+
- PostgreSQL database
- npm or yarn

## Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd uphold
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   Create a `.env` file in the root directory:
   ```env
   # Database
   DATABASE_URL="postgresql://username:password@localhost:5432/uphold?schema=public"
   
   # JWT
   JWT_SECRET="your-super-secret-jwt-key-here"
   JWT_EXPIRES_IN="90d"
   JWT_COOKIE_EXPIRES_IN="90"
   
   # Environment
   NODE_ENV="development"
   ```

4. **Database Setup**
   ```bash
   # Generate Prisma client
   npm run db:generate
   
   # Push schema to database (for development)
   npm run db:push
   
   # Or run migrations (for production)
   npm run db:migrate
   ```

5. **Start Development Server**
   ```bash
   npm run dev
   ```

## Database Commands

- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema changes to database (development)
- `npm run db:migrate` - Create and run migrations (production)
- `npm run db:studio` - Open Prisma Studio for database management

## API Endpoints

### Authentication
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/logout` - User logout
- `POST /api/v1/auth/forgot-password` - Request password reset
- `POST /api/v1/auth/reset-password/:token` - Reset password
- `PATCH /api/v1/auth/update-password` - Update password

### Users
- `GET /api/v1/users` - Get all users
- `GET /api/v1/users/:id` - Get user by ID
- `PATCH /api/v1/users/:id` - Update user
- `DELETE /api/v1/users/:id` - Delete user

### Profile
- `GET /api/v1/users/profile` - Get user profile
- `PUT /api/v1/users/profile` - Update user profile

### Accountability Partners
- `GET /api/v1/users/partners` - Get user's partners
- `POST /api/v1/users/partners` - Add new partner
- `PUT /api/v1/users/partners/:id` - Update partner
- `DELETE /api/v1/users/partners/:id` - Remove partner

## Project Structure

```
src/
├── controllers/     # Route controllers
├── lib/            # Prisma client
├── middleware/     # Express middleware
├── routes/         # API routes
├── schemas/        # Zod validation schemas
├── service/        # Business logic
├── types/          # TypeScript type definitions
├── utils/          # Utility functions
└── index.ts        # Application entry point
```

## Development

- **Build**: `npm run build`
- **Start Production**: `npm start`
- **Clean**: `npm run clean`

## Database Schema

The application uses Prisma with the following main models:

- **User**: Core user information and authentication
- **Profile**: User onboarding and habit tracking
- **AccountabilityPartner**: Partner relationships and permissions

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT