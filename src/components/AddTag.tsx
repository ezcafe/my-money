import React, { useContext } from "react";
import { useForm } from "react-hook-form";

import ErrorComponent from "./ui/Error";
import { AppContext, IAppContext } from "../store/store";
import { addTagAction } from "../actions/tag";
import { ITagData } from "../types/tag";

import "../styles/AddTag.css";

interface IAddTagProps {}

const defaultTag: ITagData = {
    name: "",
};

const AddTag = (props: IAddTagProps) => {
    const { dispatch } = useContext<IAppContext>(AppContext);
    const { register, handleSubmit, errors } = useForm<ITagData>();

    const onSubmit = (data: ITagData) => {
        dispatch(addTagAction(data));
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="ui form Page AddTag">
            <div className="field">
                <label>Name</label>
                <input
                    defaultValue={defaultTag.name}
                    name="name"
                    placeholder="Name..."
                    type="text"
                    ref={register({ required: true })}
                />
                {errors.name && <ErrorComponent header="Error" message="This field is required" />}
            </div>

            <button className="ui primary button">Add tag</button>
        </form>
    );
};

export default AddTag;
