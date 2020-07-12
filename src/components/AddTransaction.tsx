import React, { useContext } from "react";
import { DateTime } from "luxon";
import { useForm } from "react-hook-form";

import AmountComponent from "./ui/Amount";
import ErrorComponent from "./ui/Error";
import { AppContext, IAppContext } from "../store/store";
import { addTransactionAction } from "../actions/transaction";
import { IAccount } from "../types/account";
import { ITransactionData } from "../types/transaction";

import "../styles/AddTransaction.css";

interface IAddTransactionProps {}

const defaultTransaction: ITransactionData = {
    amount: "0",
    tagIds: "",
    note: "",
    accountId: "",
    time: 0,
};

const AddTransaction = (props: IAddTransactionProps) => {
    const {
        state: { accounts },
        dispatch,
    } = useContext<IAppContext>(AppContext);
    const { register, handleSubmit, errors } = useForm<ITransactionData>();

    const onSubmit = (data: ITransactionData) => {
        dispatch(
            addTransactionAction({
                ...data,
                time: DateTime.local().toMillis(),
            }),
        );
    };

    const accountOptions: React.ReactElement[] = accounts.map(
        (account: IAccount): React.ReactElement => {
            const { id } = account;
            return (
                <option key={id} value={id}>
                    {account.name}
                </option>
            );
        },
    );

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="ui form Page AddTransaction">
            <AmountComponent
                amount={defaultTransaction.amount}
                error={errors.amount}
                register={register}
            />

            <div className="field">
                <label>Account</label>
                <select className="ui fluid dropdown" name="accountId" ref={register}>
                    {accountOptions}
                </select>
            </div>

            <div className="field">
                <label>Tags</label>
                <input
                    defaultValue={defaultTransaction.tagIds}
                    name="tags"
                    placeholder="Tags..."
                    type="text"
                    ref={register({ required: true })}
                />
                {errors.tagIds && (
                    <ErrorComponent header="Error" message="This field is required" />
                )}
            </div>

            <div className="field">
                <label>Note</label>
                <textarea
                    defaultValue={defaultTransaction.note}
                    name="note"
                    placeholder="Note..."
                    rows={2}
                    ref={register}
                />
            </div>

            <button className="ui primary button">Add transaction</button>
        </form>
    );
};

export default AddTransaction;
