import React from "react";
import { FieldError } from "react-hook-form";

import ErrorComponent from "./Error";

interface IAmountProps {
    amount: string;
    error: FieldError | undefined;
    register: any;
}

const Amount = (props: IAmountProps) => {
    const { amount, error, register } = props;

    return (
        <div className="field">
            <label>Amount</label>
            <div className="ui labeled input">
                <label className="ui label">$</label>
                <input
                    defaultValue={amount}
                    name="amount"
                    placeholder="25k"
                    type="text"
                    ref={register({ required: true })}
                />
            </div>
            {error && <ErrorComponent header="Error" message="This field is required" />}
        </div>
    );
};

export default Amount;
