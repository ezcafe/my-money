import { DateTime } from "luxon";
import { v4 as uuidv4 } from "uuid";

import Action from "../actions";
import { TransactionTypes } from "../actions/transaction";
import { ITransaction, ITransactionData, ITransactionGroup } from "../types/transaction";

export type TransactionState = {
    [groupKey: string]: ITransactionGroup;
};

function getTransactionGroupKey(time: number): string {
    const date = DateTime.fromMillis(time);
    return date.toFormat("yyyy/MM");
}

function addTransactionReducer(
    state: TransactionState,
    transaction: ITransactionData,
): TransactionState {
    const groupKey: string = getTransactionGroupKey(transaction.time);

    const newTransaction: ITransaction = {
        ...transaction,
        id: `transaction-${uuidv4()}`,
    };

    return {
        ...state,
        [groupKey]: [...(state[groupKey] || []), newTransaction],
    };
}

function removeTransactionReducer(
    state: TransactionState,
    id: string,
    time: number,
): TransactionState {
    const groupKey: string = getTransactionGroupKey(time);

    const group: ITransactionGroup = (state[groupKey] || []).reduce(
        (result: ITransactionGroup, transaction: ITransaction): ITransactionGroup => {
            if (transaction.id === id) {
                return result;
            }
            return [...result, transaction];
        },
        [],
    );

    return {
        ...state,
        [groupKey]: group,
    };
}

export const transactionReducer = (state: TransactionState, action: Action): TransactionState => {
    switch (action.type) {
        case TransactionTypes.ADD:
            return addTransactionReducer(state, action.payload.transaction);
        case TransactionTypes.REMOVE: {
            const { id, time } = action.payload;
            return removeTransactionReducer(state, id, time);
        }
        default:
            return state;
    }
};
