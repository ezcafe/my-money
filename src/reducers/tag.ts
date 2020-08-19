import { v4 as uuidv4 } from "uuid";
import Action from "../actions";
import { TagTypes } from "../actions/tag";
import { ITag, ITagData } from "../types/tag";

export type TagState = ITag[];

function addTagReducer(state: TagState, tag: ITagData): TagState {
    const newTag: ITag = {
        ...tag,
        id: `tag-${uuidv4()}`,
    };
    return [...state, newTag];
}

function removeTagReducer(state: TagState, id: string): TagState {
    return state.reduce((_state: TagState, tag: ITag): TagState => {
        if (tag.id === id) {
            return _state;
        }
        return [..._state, tag];
    }, []);
}

export const tagReducer = (state: TagState, action: Action): TagState => {
    switch (action.type) {
        case TagTypes.ADD:
            return addTagReducer(state, action.payload.tag);
        case TagTypes.REMOVE:
            return removeTagReducer(state, action.payload.id);
        default:
            return state;
    }
};
