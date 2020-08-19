import { ITransactionData } from "../types/transaction";

export enum TransactionTypes {
    ADD = "ADD_TRANSACTION",
    REMOVE = "REMOVE_TRANSACTION",
}

interface IAddTransactionAction {
    type: TransactionTypes.ADD;
    payload: { transaction: ITransactionData };
}

export const addTransactionAction = (transaction: ITransactionData): IAddTransactionAction => ({
    type: TransactionTypes.ADD,
    payload: {
        transaction,
    },
});

interface IRemoveTransactionAction {
    type: TransactionTypes.REMOVE;
    payload: { id: string; time: number };
}

export const removeTransactionAction = (id: string, time: number): IRemoveTransactionAction => ({
    type: TransactionTypes.REMOVE,
    payload: { id, time },
});

export type TransactionActions = IAddTransactionAction | IRemoveTransactionAction;
