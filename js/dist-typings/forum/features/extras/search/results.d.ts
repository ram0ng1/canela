import type Discussion from 'flarum/common/models/Discussion';
import type Post from 'flarum/common/models/Post';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';
import { type CanelaTag } from '../../../utils/tags';
/**
 * Resultados ainda vindo (a primeira página de uma busca): linhas com as
 * classes das reais (avatar, título, badges e o trecho de duas linhas), com
 * barras de texto no lugar do texto, para os resultados chegarem onde o
 * esqueleto estava.
 */
export declare function resultSkeleton(rows?: number): Mithril.Children[];
export declare function discussionResult(discussion: Discussion, pattern: RegExp | undefined): Mithril.Children;
export declare function postResult(post: Post, pattern: RegExp | undefined): Mithril.Children;
export declare function tagResult(tag: CanelaTag, pattern: RegExp | undefined): Mithril.Children;
export declare function userResult(user: User, pattern: RegExp | undefined): Mithril.Children;
