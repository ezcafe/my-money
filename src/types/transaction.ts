export interface ITransactionData {
    accountId: string;
    amount: string;
    note?: string;
    tagIds: string;
    time: number;
}

export interface ITransaction extends ITransactionData {
    id: string;
}

export type ITransactionGroup = ITransaction[];
