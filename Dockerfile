# Use Bun’s official lightweight base image
FROM oven/bun:1.1.13-slim

# Create app directory
WORKDIR /app

# Copy all files
COPY . .

# (Optional) Install TypeScript if you're compiling .ts directly
RUN bun add -d typescript

# Precompile TypeScript
RUN bun tsc

# Expose the port Bun will run on
EXPOSE 3000

# Run the compiled app
CMD ["bun", "run", "dist/index.js"]
