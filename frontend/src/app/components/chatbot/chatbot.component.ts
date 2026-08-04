import { Component, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AIService, ChatMessage } from '../../services/ai.service';
import { AuthService } from '../../services/auth.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Floating Chat Toggle Button -->
    <button class="chat-toggle-btn pulse-active" (click)="isOpen = !isOpen">
      <span class="material-icons-round" *ngIf="!isOpen">smart_toy</span>
      <span class="material-icons-round" *ngIf="isOpen">close</span>
      <span class="btn-text">AI Assistant</span>
      <span class="active-badge" *ngIf="activeContext$ | async">CTX</span>
    </button>

    <!-- Main Chat Window Drawer -->
    <div class="chat-window glass-panel" [class.open]="isOpen">
      
      <!-- Chat Header -->
      <div class="chat-header">
        <div class="header-info">
          <div class="ai-avatar">
            <span class="material-icons-round">psychology</span>
          </div>
          <div>
            <h3>GovPortal AI Assistant</h3>
            <span class="role-intel-tag" *ngIf="session$ | async as session">
              Level: {{ session.role === 'ROLE_EMPLOYEE' ? '3. Employee AI' : (session.role === 'ROLE_USER' ? '2. Citizen AI' : '1. Public AI') }}
            </span>
          </div>
        </div>
        <button class="icon-btn" (click)="isOpen = false"><span class="material-icons-round">expand_more</span></button>
      </div>

      <!-- Active Application Context Chip (When Reviewing Pending Application) -->
      <div class="active-context-banner" *ngIf="activeContext$ | async as ctx">
        <span class="material-icons-round color-cyan">dataset</span>
        <div class="ctx-details">
          <span class="ctx-title">Active Review Context:</span>
          <strong>{{ ctx.firstName }} {{ ctx.lastName }} (<code>{{ ctx.registrationId }}</code>)</strong>
        </div>
        <button class="ctx-clear" (click)="clearContext()"><span class="material-icons-round">close</span></button>
      </div>

      <!-- Chat Trajectory Messages -->
      <div class="chat-body" #scrollContainer>
        <div *ngFor="let msg of messages$ | async" class="msg-row" [class.user-row]="msg.sender === 'user'">
          
          <div class="msg-avatar" *ngIf="msg.sender === 'ai'">
            <span class="material-icons-round">smart_toy</span>
          </div>

          <div class="msg-bubble" [ngClass]="{
            'user-bubble': msg.sender === 'user',
            'ai-bubble': msg.sender === 'ai',
            'error-bubble': msg.isError
          }">
            
            <!-- Tool Badge -->
            <div class="tool-badge-row" *ngIf="msg.toolsUsed && msg.toolsUsed.length > 0">
              <span class="tool-chip" *ngFor="let t of msg.toolsUsed">
                <span class="material-icons-round font-12">build</span> {{ t }}
              </span>
              <span class="ctx-chip" *ngIf="msg.contextUsed">
                <span class="material-icons-round font-12">dataset</span> Context Absorbed
              </span>
            </div>

            <!-- Pulsing Loading Indicator -->
            <div class="typing-indicator" *ngIf="msg.isLoading">
              <span></span>
              <span></span>
              <span></span>
            </div>

            <!-- Message Text -->
            <div class="msg-text" *ngIf="!msg.isLoading" [innerHTML]="formatMarkdown(msg.text)"></div>
            <span class="msg-time" *ngIf="!msg.isLoading">{{ msg.timestamp | date:'shortTime' }}</span>
          </div>

        </div>
      </div>

      <!-- Context-Aware Quick Suggested Prompts Pills -->
      <div class="chat-suggestions" *ngIf="session$ | async as session">
        
        <!-- Employee Active Context Prompts -->
        <ng-container *ngIf="session.role === 'ROLE_EMPLOYEE' && (activeContext$ | async) as ctx">
          <button class="sug-pill" (click)="sendPrompt('What is the address of this applicant?')">
            <span class="material-icons-round">home</span> "What is the address?"
          </button>
          <button class="sug-pill" (click)="sendPrompt('What is the PAN of this applicant?')">
            <span class="material-icons-round">badge</span> "What is the PAN?"
          </button>
          <button class="sug-pill" (click)="sendPrompt('Why was this flagged as a duplicate?')">
            <span class="material-icons-round">flag</span> "Why was this flagged?"
          </button>
          <button class="sug-pill" (click)="sendPrompt('What fields matched?')">
            <span class="material-icons-round">fact_check</span> "What fields matched?"
          </button>
        </ng-container>

        <!-- Employee General Prompts -->
        <ng-container *ngIf="session.role === 'ROLE_EMPLOYEE' && !(activeContext$ | async)">
          <button class="sug-pill" (click)="sendPrompt('Show pending users')">
            <span class="material-icons-round">list</span> "Show pending users"
          </button>
          <button class="sug-pill" (click)="sendPrompt('Search Rahul Sharma')">
            <span class="material-icons-round">search</span> "Search Rahul Sharma"
          </button>
          <button class="sug-pill" (click)="sendPrompt('Check duplicate registrations')">
            <span class="material-icons-round">find_in_page</span> "Check duplicates"
          </button>
        </ng-container>

        <!-- Citizen Prompts -->
        <ng-container *ngIf="session.role === 'ROLE_USER'">
          <button class="sug-pill" (click)="sendPrompt('What is my registration status?')">
            <span class="material-icons-round">pending_actions</span> "What is my status?"
          </button>
          <button class="sug-pill" (click)="sendPrompt('Why am I still waiting?')">
            <span class="material-icons-round">help</span> "Why am I waiting?"
          </button>
        </ng-container>

        <!-- Public Prompts -->
        <ng-container *ngIf="session.role === 'PUBLIC'">
          <button class="sug-pill" (click)="sendPrompt('What documents are required?')">
            <span class="material-icons-round">description</span> "What documents required?"
          </button>
          <button class="sug-pill" (click)="sendPrompt('What is vendor registration?')">
            <span class="material-icons-round">menu_book</span> "What is vendor registration?"
          </button>
        </ng-container>

      </div>

      <!-- Input Box -->
      <div class="chat-footer">
        <input 
          type="text" 
          [(ngModel)]="userInput" 
          (keyup.enter)="onSend()"
          placeholder="Ask AI Assistant (e.g. status, FAQ, search)..."
          class="chat-input">
        <button class="send-btn" (click)="onSend()">
          <span class="material-icons-round">send</span>
        </button>
      </div>

    </div>
  `,
  styles: [`
    .chat-toggle-btn {
      position: fixed;
      bottom: 1.5rem;
      right: 1.5rem;
      z-index: 999;
      background: linear-gradient(135deg, var(--accent-cyan) 0%, var(--accent-blue) 100%);
      color: #000;
      border: none;
      padding: 0.8rem 1.4rem;
      border-radius: 30px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      box-shadow: 0 10px 30px rgba(0, 242, 254, 0.4);
      font-family: var(--font-heading);
    }
    .active-badge {
      background: #000;
      color: var(--accent-cyan);
      font-size: 0.65rem;
      padding: 0.15rem 0.4rem;
      border-radius: 6px;
    }
    .chat-window {
      position: fixed;
      bottom: 5.5rem;
      right: 1.5rem;
      width: 420px;
      height: 580px;
      max-width: calc(100vw - 3rem);
      max-height: calc(100vh - 7rem);
      z-index: 998;
      display: flex;
      flex-direction: column;
      background: rgba(17, 24, 39, 0.95);
      border: 1px solid rgba(0, 242, 254, 0.3);
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7);
      opacity: 0;
      pointer-events: none;
      transform: translateY(20px) scale(0.95);
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .chat-window.open {
      opacity: 1;
      pointer-events: all;
      transform: translateY(0) scale(1);
    }
    .chat-header {
      padding: 1rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: rgba(0, 0, 0, 0.3);
    }
    .header-info { display: flex; align-items: center; gap: 0.6rem; }
    .ai-avatar {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: rgba(0, 242, 254, 0.15);
      color: var(--accent-cyan);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .header-info h3 { font-family: var(--font-heading); font-size: 0.95rem; font-weight: 700; }
    .role-intel-tag { font-size: 0.72rem; color: var(--accent-cyan); font-weight: 600; }
    .icon-btn { background: transparent; border: none; color: var(--text-muted); cursor: pointer; }
    .active-context-banner {
      background: rgba(0, 242, 254, 0.1);
      border-bottom: 1px solid rgba(0, 242, 254, 0.25);
      padding: 0.5rem 0.8rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.75rem;
    }
    .color-cyan { color: var(--accent-cyan); }
    .ctx-details { flex: 1; }
    .ctx-title { color: var(--text-muted); display: block; font-size: 0.65rem; }
    .ctx-clear { background: transparent; border: none; color: var(--text-muted); cursor: pointer; }
    .chat-body {
      flex: 1;
      overflow-y: auto;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
    }
    .msg-row { display: flex; gap: 0.5rem; }
    .user-row { justify-content: flex-end; }
    .msg-avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: rgba(0, 242, 254, 0.2);
      color: var(--accent-cyan);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      margin-top: 4px;
    }
    .msg-bubble {
      max-width: 85%;
      padding: 0.75rem 0.95rem;
      border-radius: 14px;
      font-size: 0.83rem;
      line-height: 1.5;
    }
    .ai-bubble {
      background: rgba(31, 41, 55, 0.9);
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: #f3f4f6;
      border-top-left-radius: 4px;
    }
    .user-bubble {
      background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
      color: #000;
      font-weight: 500;
      border-top-right-radius: 4px;
    }
    .error-bubble {
      background: rgba(127, 29, 29, 0.4);
      border: 1px solid rgba(239, 68, 68, 0.4);
      color: #fca5a5;
    }
    .tool-badge-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.3rem;
      margin-bottom: 0.4rem;
    }
    .tool-chip, .ctx-chip {
      font-size: 0.65rem;
      background: rgba(0, 0, 0, 0.4);
      padding: 0.15rem 0.4rem;
      border-radius: 4px;
      display: flex;
      align-items: center;
      gap: 0.2rem;
      color: var(--accent-cyan);
      border: 1px solid rgba(0, 242, 254, 0.3);
    }
    .typing-indicator {
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 6px 4px;
    }
    .typing-indicator span {
      width: 7px;
      height: 7px;
      background: var(--accent-cyan);
      border-radius: 50%;
      display: inline-block;
      animation: pulseBounce 1.4s infinite ease-in-out both;
    }
    .typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
    .typing-indicator span:nth-child(2) { animation-delay: -0.16s; }
    @keyframes pulseBounce {
      0%, 80%, 100% { transform: scale(0.3); opacity: 0.3; }
      40% { transform: scale(1.1); opacity: 1; }
    }
    .font-12 { font-size: 12px; }
    .msg-time { font-size: 0.65rem; opacity: 0.6; display: block; margin-top: 0.4rem; text-align: right; }
    .chat-suggestions {
      padding: 0.5rem 0.8rem;
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(0, 0, 0, 0.2);
    }
    .sug-pill {
      background: rgba(0, 242, 254, 0.08);
      border: 1px solid rgba(0, 242, 254, 0.25);
      color: #7dd3fc;
      font-size: 0.72rem;
      padding: 0.25rem 0.6rem;
      border-radius: 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.2rem;
    }
    .sug-pill:hover { background: rgba(0, 242, 254, 0.2); color: white; }
    .chat-footer {
      padding: 0.8rem;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      display: flex;
      gap: 0.5rem;
    }
    .chat-input {
      flex: 1;
      background: rgba(0, 0, 0, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: white;
      padding: 0.6rem 0.9rem;
      border-radius: 20px;
      font-size: 0.82rem;
    }
    .chat-input:focus { outline: none; border-color: var(--accent-cyan); }
    .send-btn {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--accent-cyan) 0%, var(--accent-blue) 100%);
      color: black;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  `]
})
export class ChatbotComponent implements AfterViewChecked {
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  isOpen = false;
  userInput = '';

  session$: Observable<any> = this.authService.currentSession$;
  messages$: Observable<ChatMessage[]> = this.aiService.chatMessages$;
  activeContext$: Observable<any> = this.aiService.activeAppContext$;

  constructor(
    private aiService: AIService,
    private authService: AuthService
  ) {}

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  scrollToBottom(): void {
    try {
      this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
    } catch (err) {}
  }

  onSend() {
    if (!this.userInput.trim()) return;
    const text = this.userInput;
    this.userInput = '';
    this.aiService.sendMessage(text);
  }

  sendPrompt(promptText: string) {
    this.aiService.sendMessage(promptText);
  }

  clearContext() {
    this.aiService.setActiveAppContext(null);
  }

  formatMarkdown(text: string): string {
    if (!text) return '';
    return text
      .replace(/\n\n/g, '<br/><br/>')
      .replace(/\n/g, '<br/>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/### (.*?)(<br\/>|$)/g, '<h4 style="margin:8px 0 4px 0;color:#00f2fe;font-size:0.95rem;">$1</h4>')
      .replace(/#### (.*?)(<br\/>|$)/g, '<h5 style="margin:6px 0 4px 0;color:#38bdf8;font-size:0.88rem;">$1</h5>')
      .replace(/• (.*?)(<br\/>|$)/g, '<span style="color:#00f2fe;">•</span> $1<br/>');
  }
}
