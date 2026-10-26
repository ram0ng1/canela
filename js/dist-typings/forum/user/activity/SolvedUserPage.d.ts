import PostsUserPage from 'flarum/forum/components/PostsUserPage';
import type User from 'flarum/common/models/User';
export default class SolvedUserPage extends PostsUserPage {
    show(user: User): void;
    params(user: User): any;
}
