import React, { useContext } from "react";
import { useForm } from "react-hook-form";

import AmountComponent from "./ui/Amount";
import ErrorComponent from "./ui/Error";
import TotalPercentComponent from "./ui/TotalPercent";
import { AppContext, IAppContext } from "../store/store";
import { addAccountAction } from "../actions/account";
import { percentRules, percentTotalMessage } from "../constants/rules";
import { IAccountData } from "../types/account";
import { totalPercent } from "../utils/account";

import "../styles/AddAccount.css";

interface IAddAccountProps {}

const defaultAccount: IAccountData = {
    amount: "0",
    name: "",
    note: "",
    percent: 10,
};

const AddAccount = (props: IAddAccountProps) => {
    const {
        state: { accounts },
        dispatch,
    } = useContext<IAppContext>(AppContext);
    const { register, handleSubmit, errors } = useForm<IAccountData>();

    const onSubmit = (data: IAccountData) => {
        dispatch(addAccountAction(data));
    };

    const total = totalPercent(accounts);
    const percentValidator = (value: string) => {
        return total + parseFloat(value) <= 100 || percentTotalMessage;
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="ui form Page AddAccount">
            <div className="field">
                <label>Name</label>
                <input
                    defaultValue={defaultAccount.name}
                    name="name"
                    placeholder="Name..."
                    type="text"
                    ref={register({ required: true })}
                />
                {errors.name && <ErrorComponent header="Error" message="This field is required" />}
            </div>

            <AmountComponent
                amount={defaultAccount.amount}
                error={errors.amount}
                register={register}
            />

            <div className="field">
                <label>Percent</label>
                <div className="ui right labeled input">
                    <input
                        defaultValue={defaultAccount.percent}
                        name="percent"
                        placeholder="Percent..."
                        type="number"
                        ref={register({
                            ...percentRules,
                            validate: percentValidator,
                        })}
                    />
                    <div className="ui basic label">%</div>
                </div>
                {errors.percent && (
                    <React.Fragment>
                        <ErrorComponent header="Error" message={errors.percent.message || ""} />
                        <TotalPercentComponent accounts={accounts} />
                    </React.Fragment>
                )}
            </div>

            <div className="field">
                <label>Note</label>
                <textarea
                    defaultValue={defaultAccount.note}
                    name="note"
                    placeholder="Note..."
                    rows={2}
                    ref={register}
                />
            </div>

            <button className="ui primary button">Add account</button>
        </form>
    );
};

export default AddAccount;
