/**
 * Prisma configuration file for Prisma 7+
 * This file replaces the datasource URL configuration that was previously in schema.prisma
 * The datasource URL is now configured here for Prisma Migrate commands
 */

export default {
  datasource: {
    url: process.env.DATABASE_URL,
  },
};

