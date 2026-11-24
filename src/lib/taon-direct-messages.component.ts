import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import type { TaonDirectConversationEntity } from './taon-direct-conversation.entity';
import type { TaonDirectMessageEntity } from './taon-direct-message.entity';
import { TaonMessengerApiService } from './taon-messenger-api.service';

@Component({
  selector: 'taon-direct-messages',
  standalone: true,
  imports: [
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule,
  ],
  template: `
    <mat-card>
      <mat-card-title class="p-4">Wiadomości</mat-card-title>
      <mat-card-content>
        @for (message of messages(); track message.id) {
          <div>{{ message.senderType }}: {{ message.content }}</div>
        }
        <mat-form-field class="w-full">
          <textarea
            matInput
            [(ngModel)]="draft"
            rows="3"
            (keydown.enter)="onEnter($event)"></textarea>
        </mat-form-field>
        <button
          mat-flat-button
          (click)="send()">
          Wyślij wiadomość
        </button>
      </mat-card-content>
    </mat-card>
  `,
  providers: [TaonMessengerApiService],
})
export class TaonDirectMessagesComponent implements OnInit, OnDestroy {
  private readonly api = inject(TaonMessengerApiService);

  readonly messages = signal<TaonDirectMessageEntity[]>([]);

  conversation?: TaonDirectConversationEntity;

  draft = '';

  private timer?: ReturnType<typeof setInterval>;

  async ngOnInit() {
    await this.open();
    this.timer = setInterval(() => void this.poll(), 5000);
  }

  ngOnDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async open() {
    this.conversation = await this.api.conversation();
    await this.poll();
    await this.api.markRead(this.conversation.id);
  }

  async poll() {
    if (!this.conversation) return;
    const cursor = this.messages().at(-1)?.cursor || 0;
    const newer = await this.api.messages(this.conversation.id, cursor);
    if (newer.length) this.messages.update(items => [...items, ...newer]);
  }

  onEnter(event: Event) {
    const keyboard = event as KeyboardEvent;
    if (!keyboard.shiftKey) {
      keyboard.preventDefault();
      void this.send();
    }
  }

  async send() {
    const content = this.draft.trim();
    if (!content || !this.conversation) return;
    const sent = await this.api.send(this.conversation.id, content);
    this.draft = '';
    this.messages.update(items => [...items, sent]);
  }
}
