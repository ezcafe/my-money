import { ITagData } from "../types/tag";

export enum TagTypes {
    ADD = "ADD_CATEGORY",
    REMOVE = "REMOVE_CATEGORY",
}

interface IAddTagAction {
    type: TagTypes.ADD;
    payload: { tag: ITagData };
}

export const addTagAction = (tag: ITagData): IAddTagAction => ({
    type: TagTypes.ADD,
    payload: {
        tag,
    },
});

interface IRemoveTagAction {
    type: TagTypes.REMOVE;
    payload: { id: string };
}

export const removeTagAction = (id: string): IRemoveTagAction => ({
    type: TagTypes.REMOVE,
    payload: { id },
});

export type TagActions = IAddTagAction | IRemoveTagAction;
