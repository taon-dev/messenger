import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';

import type { TaonDirectConversationEntity } from './taon-direct-conversation.entity';
import type { TaonDirectMessageEntity } from './taon-direct-message.entity';
import { TaonMessengerApiService } from './taon-messenger-api.service';

@Component({
  selector: 'taon-messenger-backoffice',
  standalone: true,
  imports: [
    MatCardModule,
    MatListModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule,
  ],
  template: `
    <div class="grid md:grid-cols-[280px_1fr] gap-4">
      <mat-card>
        <mat-card-title class="p-4">Rozmowy</mat-card-title>
        <mat-nav-list>
          @for (conversation of conversations(); track conversation.id) {
            <button
              mat-list-item
              (click)="open(conversation)">
              Klient #{{ conversation.clientId }}
              <small>{{ conversation.updatedAt }}</small>
            </button>
          }
        </mat-nav-list>
      </mat-card>
      <mat-card>
        @if (selected()) {
          <mat-card-title class="p-4">Klient #{{ selected()!.clientId }}</mat-card-title>
          <mat-card-content>
            @for (message of messages(); track message.id) {
              <div>
                <strong
                  >{{
                    message.senderType === 'administrator'
                      ? 'Taon Agency'
                      : 'Klient'
                  }}:</strong
                >
                {{ message.content }}
              </div>
            }
            <mat-form-field class="w-full">
              <textarea
                matInput
                [(ngModel)]="draft"
                rows="3"></textarea>
            </mat-form-field>
            <button
              mat-flat-button
              (click)="send()">
              Wyślij
            </button>
          </mat-card-content>
        } @else {
          <mat-card-content>Wybierz rozmowę.</mat-card-content>
        }
      </mat-card>
    </div>
  `,
  providers: [TaonMessengerApiService],
})
export class TaonMessengerBackofficeComponent implements OnInit, OnDestroy {
  private readonly api = inject(TaonMessengerApiService);

  readonly conversations = signal<TaonDirectConversationEntity[]>([]);

  readonly selected = signal<TaonDirectConversationEntity | null>(null);

  readonly messages = signal<TaonDirectMessageEntity[]>([]);

  draft = '';

  private timer?: ReturnType<typeof setInterval>;

  async ngOnInit() {
    this.conversations.set(await this.api.conversations());
    this.timer = setInterval(() => void this.refresh(), 5000);
  }

  ngOnDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async open(conversation: TaonDirectConversationEntity) {
    this.selected.set(conversation);
    this.messages.set([]);
    await this.refresh();
    await this.api.markRead(conversation.id);
  }

  async refresh() {
    const conversation = this.selected();
    if (!conversation) return;
    const cursor = this.messages().at(-1)?.cursor || 0;
    const newer = await this.api.messages(conversation.id, cursor);
    if (newer.length) this.messages.update(items => [...items, ...newer]);
  }

  async send() {
    const conversation = this.selected();
    const content = this.draft.trim();
    if (!conversation || !content) return;
    const sent = await this.api.send(conversation.id, content);
    this.draft = '';
    this.messages.update(items => [...items, sent]);
  }
}
