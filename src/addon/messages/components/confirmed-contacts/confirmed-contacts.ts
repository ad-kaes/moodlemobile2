// (C) Copyright 2015 Martin Dougiamas
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { Component, EventEmitter, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { Content } from 'ionic-angular';
import { CoreEventsProvider } from '@providers/events';
import { CoreSitesProvider } from '@providers/sites';
import { AddonMessagesProvider } from '../../providers/messages';
import { CoreDomUtilsProvider } from '@providers/utils/dom';

/**
 * Component that displays the list of confirmed contacts.
 */
@Component({
    selector: 'addon-messages-confirmed-contacts',
    templateUrl: 'addon-messages-confirmed-contacts.html',
})
export class AddonMessagesConfirmedContactsComponent implements OnInit, OnDestroy {
    @Output() onUserSelected = new EventEmitter<{userId: number, onInit?: boolean}>();
    @ViewChild(Content) content: Content;

    loaded = false;
    canLoadMore = false;
    loadMoreError = false;
    contacts = [];
    selectedUserId: number;

    protected memberInfoObserver;

    constructor(private domUtils: CoreDomUtilsProvider, eventsProvider: CoreEventsProvider, sitesProvider: CoreSitesProvider,
            private messagesProvider: AddonMessagesProvider) {

        this.onUserSelected = new EventEmitter();

        // Update block status of a user.
        this.memberInfoObserver = eventsProvider.on(AddonMessagesProvider.MEMBER_INFO_CHANGED_EVENT, (data) => {
            if (data.userBlocked || data.userUnblocked) {
                const user = this.contacts.find((user) => user.id == data.userId);
                if (user) {
                    user.isblocked = data.userBlocked;
                }
            } else if (data.contactRemoved) {
                const index = this.contacts.findIndex((contact) => contact.id == data.userId);
                if (index >= 0) {
                    this.contacts.splice(index, 1);
                }
            } else if (data.contactRequestConfirmed) {
                this.refreshData();
            }
        }, sitesProvider.getCurrentSiteId());
    }

    /**
     * Component loaded.
     */
    ngOnInit(): void {
        this.fetchData().then(() => {
            if (this.contacts.length) {
                this.selectUser(this.contacts[0].id, true);
            }
        }).finally(() => {
            this.loaded = true;
        });

        // Workaround for infinite scrolling.
        this.content.resize();
    }

    /**
     * Fetch contacts.
     *
     * @param {boolean} [refresh=false] True if we are refreshing contacts, false if we are loading more.
     * @return {Promise<any>} Promise resolved when done.
     */
    fetchData(refresh: boolean = false): Promise<any> {
        this.loadMoreError = false;

        const limitFrom = refresh ? 0 : this.contacts.length;
        let promise;

        if (limitFrom === 0) {
            // Always try to get latest data from server.
            promise = this.messagesProvider.invalidateUserContacts().catch(() => {
                // Shouldn't happen.
            });
        } else {
            promise = Promise.resolve();
        }

        return promise.then(() => {
            return this.messagesProvider.getUserContacts(limitFrom);
        }).then((result) => {
            this.contacts = refresh ? result.contacts : this.contacts.concat(result.contacts);
            this.canLoadMore = result.canLoadMore;
        }).catch((error) => {
            this.loadMoreError = true;
            this.domUtils.showErrorModalDefault(error, 'addon.messages.errorwhileretrievingcontacts', true);
        });
    }

    /**
     * Refresh contacts.
     *
     * @param {any} [refresher] Refresher.
     * @return {Promise<any>} Promise resolved when done.
     */
    refreshData(refresher?: any): Promise<any> {
        // No need to invalidate contacts, we always try to get the latest.
        return this.fetchData(true).finally(() => {
            refresher && refresher.complete();
        });
    }

    /**
     * Load more contacts.
     *
     * @param {any} [infiniteComplete] Infinite scroll complete function. Only used from core-infinite-loading.
     * @return {Promise<any>} Resolved when done.
     */
    loadMore(infiniteComplete?: any): Promise<any> {
        return this.fetchData().finally(() => {
            infiniteComplete && infiniteComplete();
        });
    }

    /**
     * Notify that a contact has been selected.
     *
     * @param {number} userId User id.
     * @param {boolean} [onInit=false] Whether the contact is selected on initial load.
     */
    selectUser(userId: number, onInit: boolean = false): void {
        this.selectedUserId = userId;
        this.onUserSelected.emit({userId, onInit});
    }

    /**
     * Component destroyed.
     */
    ngOnDestroy(): void {
        this.memberInfoObserver && this.memberInfoObserver.off();
    }
}
