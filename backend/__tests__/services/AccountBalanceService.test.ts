/**
 * Tests for AccountBalanceService
 * TDD: These tests are written first, then implementation follows
 */

import {describe, it, expect, beforeEach, afterEach} from '@jest/globals';
import {prisma} from '../../src/utils/prisma';
import {
  calculateAccountBalance,
  updateAccountBalance,
  getAccountBalance,
} from '../../src/services/AccountBalanceService';

describe('AccountBalanceService', () => {
  let testUserId: string;
  let testAccountId: string;

  beforeEach(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        oidcSubject: 'test-subject-' + Date.now(),
        email: 'test@example.com',
      },
    });
    testUserId = user.id;

    // Create test account
    const account = await prisma.account.create({
      data: {
        name: 'Test Account',
        initBalance: 1000,
        userId: testUserId,
      },
    });
    testAccountId = account.id;
  });

  afterEach(async () => {
    // Cleanup
    await prisma.transaction.deleteMany({where: {userId: testUserId}});
    await prisma.account.deleteMany({where: {userId: testUserId}});
    await prisma.user.deleteMany({where: {id: testUserId}});
  });

  describe('calculateAccountBalance', () => {
    it('should return initial balance when no transactions exist', async () => {
      const balance = await calculateAccountBalance(testAccountId);
      expect(balance).toBe(1000);
    });

    it('should calculate balance correctly with positive transactions', async () => {
      await prisma.transaction.create({
        data: {
          value: 200,
          accountId: testAccountId,
          userId: testUserId,
          date: new Date(),
        },
      });

      const balance = await calculateAccountBalance(testAccountId);
      expect(balance).toBe(1200); // 1000 + 200
    });

    it('should calculate balance correctly with negative transactions', async () => {
      await prisma.transaction.create({
        data: {
          value: -100,
          accountId: testAccountId,
          userId: testUserId,
          date: new Date(),
        },
      });

      const balance = await calculateAccountBalance(testAccountId);
      expect(balance).toBe(900); // 1000 - 100
    });

    it('should calculate balance correctly with multiple transactions', async () => {
      await prisma.transaction.createMany({
        data: [
          {value: 200, accountId: testAccountId, userId: testUserId, date: new Date()},
          {value: -50, accountId: testAccountId, userId: testUserId, date: new Date()},
          {value: 300, accountId: testAccountId, userId: testUserId, date: new Date()},
        ],
      });

      const balance = await calculateAccountBalance(testAccountId);
      expect(balance).toBe(1450); // 1000 + 200 - 50 + 300
    });

    it('should throw error if account does not exist', async () => {
      await expect(calculateAccountBalance('non-existent-id')).rejects.toThrow();
    });
  });

  describe('updateAccountBalance', () => {
    it('should add positive value to account balance', async () => {
      const newBalance = await updateAccountBalance(testAccountId, 200);
      expect(newBalance).toBe(1200); // 1000 + 200
    });

    it('should subtract negative value from account balance', async () => {
      const newBalance = await updateAccountBalance(testAccountId, -100);
      expect(newBalance).toBe(900); // 1000 - 100
    });

    it('should handle zero value', async () => {
      const newBalance = await updateAccountBalance(testAccountId, 0);
      expect(newBalance).toBe(1000); // 1000 + 0
    });

    it('should throw error if account does not exist', async () => {
      await expect(updateAccountBalance('non-existent-id', 100)).rejects.toThrow();
    });
  });

  describe('getAccountBalance', () => {
    it('should return current account balance', async () => {
      const balance = await getAccountBalance(testAccountId);
      expect(balance).toBe(1000);
    });

    it('should return updated balance after transactions', async () => {
      await prisma.transaction.create({
        data: {
          value: 150,
          accountId: testAccountId,
          userId: testUserId,
          date: new Date(),
        },
      });

      const balance = await getAccountBalance(testAccountId);
      expect(balance).toBe(1150);
    });
  });
});


