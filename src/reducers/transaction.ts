import { v4 as uuidv4 } from "uuid";
import Action from "../actions";
import { TransactionTypes } from "../actions/transaction";
import { ITransaction, ITransactionData } from "../types/transaction";

export type TransactionState = ITransaction[];

function addTransactionReducer(state: TransactionState, transaction: ITransactionData) {
    const newTransaction: ITransaction = {
        ...transaction,
        id: `transaction-${uuidv4()}`,
    };
    return [...state, newTransaction];
}

function removeTransactionReducer(state: TransactionState, id: string) {
    return state.reduce((_state: TransactionState, transaction: ITransaction): TransactionState => {
        if (transaction.id === id) {
            return _state;
        }
        return [..._state, transaction];
    }, []);
}

export const transactionReducer = (state: TransactionState, action: Action) => {
    switch (action.type) {
        case TransactionTypes.ADD:
            return addTransactionReducer(state, action.payload.transaction);
        case TransactionTypes.REMOVE:
            return removeTransactionReducer(state, action.payload.id);
        default:
            return state;
    }
};
