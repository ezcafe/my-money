export interface IAccountData {
    amount: string;
    name: string;
    note?: string;
    percent: number;
}

export interface IAccount extends IAccountData {
    id: string;
}
