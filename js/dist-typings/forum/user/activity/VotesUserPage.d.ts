import PostsUserPage from 'flarum/forum/components/PostsUserPage';
import type User from 'flarum/common/models/User';
export default class VotesUserPage extends PostsUserPage {
    show(user: User): void;
    params(user: User): any;
}
