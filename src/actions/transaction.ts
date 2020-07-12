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
        transaction: {
            ...transaction,
        },
    },
});

interface IRemoveTransactionAction {
    type: TransactionTypes.REMOVE;
    payload: { id: string };
}

export const removeTransactionAction = (id: string): IRemoveTransactionAction => ({
    type: TransactionTypes.REMOVE,
    payload: { id },
});

export type TransactionActions = IAddTransactionAction | IRemoveTransactionAction;
