import { IAccount } from "../types/account";

export function findAccount(accounts: IAccount[], id: string): IAccount | undefined {
    return accounts.find((account: IAccount): boolean => account.id === id);
}

export function totalAmount(accounts: IAccount[]): number {
    return accounts.reduce((total: number, account: IAccount): number => {
        return (total += parseFloat(account.amount));
    }, 0);
}

export function totalPercent(accounts: IAccount[]): number {
    return accounts.reduce((percent: number, account: IAccount): number => {
        return (percent += account.percent);
    }, 0);
}
