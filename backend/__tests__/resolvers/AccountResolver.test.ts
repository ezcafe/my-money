/**
 * Tests for AccountResolver
 * TDD: Write tests first, then implement
 */

import {describe, it, expect, beforeEach, afterEach} from '@jest/globals';
import {prisma} from '../../src/utils/prisma';
import {AccountResolver} from '../../src/resolvers/AccountResolver';

describe('AccountResolver', () => {
  let testUserId: string;
  let testAccountId: string;
  let context: {userId: string; prisma: typeof prisma};

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: {
        oidcSubject: 'test-subject-' + Date.now(),
        email: 'test@example.com',
      },
    });
    testUserId = user.id;

    const account = await prisma.account.create({
      data: {
        name: 'Test Account',
        initBalance: 1000,
        userId: testUserId,
      },
    });
    testAccountId = account.id;

    context = {
      userId: testUserId,
      prisma,
    };
  });

  afterEach(async () => {
    await prisma.transaction.deleteMany({where: {userId: testUserId}});
    await prisma.account.deleteMany({where: {userId: testUserId}});
    await prisma.user.deleteMany({where: {id: testUserId}});
  });

  describe('accounts', () => {
    it('should return all accounts for user', async () => {
      const resolver = new AccountResolver();
      const accounts = await resolver.accounts(null, {}, context);
      expect(accounts).toHaveLength(1);
      expect(accounts[0].id).toBe(testAccountId);
    });
  });

  describe('account', () => {
    it('should return account by id', async () => {
      const resolver = new AccountResolver();
      const account = await resolver.account(null, {id: testAccountId}, context);
      expect(account).not.toBeNull();
      expect(account?.id).toBe(testAccountId);
    });

    it('should return null for non-existent account', async () => {
      const resolver = new AccountResolver();
      const account = await resolver.account(null, {id: 'non-existent'}, context);
      expect(account).toBeNull();
    });
  });

  describe('createAccount', () => {
    it('should create a new account', async () => {
      const resolver = new AccountResolver();
      const account = await resolver.createAccount(
        null,
        {
          input: {
            name: 'New Account',
            initBalance: 500,
          },
        },
        context,
      );
      expect(account.name).toBe('New Account');
      expect(Number(account.initBalance)).toBe(500);
    });
  });

  describe('updateAccount', () => {
    it('should update account name', async () => {
      const resolver = new AccountResolver();
      const account = await resolver.updateAccount(
        null,
        {
          id: testAccountId,
          input: {
            name: 'Updated Name',
          },
        },
        context,
      );
      expect(account.name).toBe('Updated Name');
    });

    it('should update account initBalance', async () => {
      const resolver = new AccountResolver();
      const account = await resolver.updateAccount(
        null,
        {
          id: testAccountId,
          input: {
            initBalance: 2000,
          },
        },
        context,
      );
      expect(Number(account.initBalance)).toBe(2000);
    });
  });

  describe('deleteAccount', () => {
    it('should delete account', async () => {
      const resolver = new AccountResolver();
      const result = await resolver.deleteAccount(null, {id: testAccountId}, context);
      expect(result).toBe(true);

      const account = await prisma.account.findUnique({where: {id: testAccountId}});
      expect(account).toBeNull();
    });

    it('should not delete default account', async () => {
      const defaultAccount = await prisma.account.create({
        data: {
          name: 'Default Account',
          initBalance: 0,
          isDefault: true,
          userId: testUserId,
        },
      });

      const resolver = new AccountResolver();
      await expect(
        resolver.deleteAccount(null, {id: defaultAccount.id}, context),
      ).rejects.toThrow();
    });
  });
});


