import { Component, ElementRef, ViewChild, AfterViewChecked, ChangeDetectorRef } from '@angular/core';
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
    <button class="chat-toggle-btn pulse-active" (click)="toggleChat()" id="chat-toggle-btn">
      <span class="material-icons-round" *ngIf="!isOpen">smart_toy</span>
      <span class="material-icons-round" *ngIf="isOpen">close</span>
      <span class="btn-text">AI Assistant</span>
      <span class="active-badge" *ngIf="activeContext$ | async">CTX</span>
    </button>

    <!-- Main Chat Window Drawer -->
    <div class="chat-window glass-panel" [class.open]="isOpen" [class.expanded]="isExpanded">
      
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
        <div class="header-actions">
          <button class="icon-btn" (click)="isExpanded = !isExpanded" title="Toggle wide mode">
            <span class="material-icons-round">{{ isExpanded ? 'close_fullscreen' : 'open_in_full' }}</span>
          </button>
          <button class="icon-btn" (click)="isOpen = false" title="Minimize">
            <span class="material-icons-round">expand_more</span>
          </button>
        </div>
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
        <div *ngFor="let msg of messages$ | async; trackBy: trackMessage" class="msg-row" [class.user-row]="msg.sender === 'user'">
          
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
              <span class="dot"></span>
              <span class="dot"></span>
              <span class="dot"></span>
            </div>

            <!-- Message Text (Rich Markdown) -->
            <div class="msg-text markdown-body" *ngIf="!msg.isLoading && msg.text" [innerHTML]="formatMarkdown(msg.text)"></div>
            <span class="msg-time" *ngIf="!msg.isLoading && msg.text">{{ msg.timestamp | date:'shortTime' }}</span>
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
    /* ═══════════════════════════════════════════════════════════════
       CHAT TOGGLE BUTTON
       ═══════════════════════════════════════════════════════════════ */
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
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .chat-toggle-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 14px 40px rgba(0, 242, 254, 0.55);
    }
    .active-badge {
      background: #000;
      color: var(--accent-cyan);
      font-size: 0.65rem;
      padding: 0.15rem 0.4rem;
      border-radius: 6px;
    }

    /* ═══════════════════════════════════════════════════════════════
       CHAT WINDOW — Dynamic Size
       ═══════════════════════════════════════════════════════════════ */
    .chat-window {
      position: fixed;
      bottom: 5.5rem;
      right: 1.5rem;
      width: 480px;
      height: 620px;
      max-width: calc(100vw - 2rem);
      max-height: calc(100vh - 6rem);
      z-index: 998;
      display: flex;
      flex-direction: column;
      background: rgba(17, 24, 39, 0.97);
      border: 1px solid rgba(0, 242, 254, 0.3);
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(0, 242, 254, 0.08);
      opacity: 0;
      pointer-events: none;
      transform: translateY(20px) scale(0.95);
      transition: width 0.35s cubic-bezier(0.4, 0, 0.2, 1), height 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s, transform 0.25s;
      border-radius: 16px;
      overflow: hidden;
    }
    .chat-window.open {
      opacity: 1;
      pointer-events: all;
      transform: translateY(0) scale(1);
    }
    .chat-window.has-table {
      width: min(880px, calc(100vw - 2rem));
    }
    .chat-window.expanded {
      width: min(1080px, calc(100vw - 2rem));
      height: min(800px, calc(100vh - 4rem));
    }

    /* ═══════════════════════════════════════════════════════════════
       CHAT HEADER
       ═══════════════════════════════════════════════════════════════ */
    .chat-header {
      padding: 0.85rem 1rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: rgba(0, 0, 0, 0.4);
      flex-shrink: 0;
    }
    .header-info { display: flex; align-items: center; gap: 0.6rem; }
    .header-actions { display: flex; gap: 0.25rem; }
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
    .header-info h3 { font-family: var(--font-heading); font-size: 0.95rem; font-weight: 700; margin: 0; }
    .role-intel-tag { font-size: 0.72rem; color: var(--accent-cyan); font-weight: 600; }
    .icon-btn {
      background: rgba(255,255,255,0.05);
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      width: 30px; height: 30px;
      border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.2s, color 0.2s;
    }
    .icon-btn:hover { background: rgba(0,242,254,0.15); color: var(--accent-cyan); }

    /* ═══════════════════════════════════════════════════════════════
       ACTIVE CONTEXT BANNER
       ═══════════════════════════════════════════════════════════════ */
    .active-context-banner {
      background: rgba(0, 242, 254, 0.08);
      border-bottom: 1px solid rgba(0, 242, 254, 0.2);
      padding: 0.5rem 0.8rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.75rem;
      flex-shrink: 0;
    }
    .color-cyan { color: var(--accent-cyan); }
    .ctx-details { flex: 1; }
    .ctx-title { color: var(--text-muted); display: block; font-size: 0.65rem; }
    .ctx-clear { background: transparent; border: none; color: var(--text-muted); cursor: pointer; }

    /* ═══════════════════════════════════════════════════════════════
       CHAT BODY — Messages Area
       ═══════════════════════════════════════════════════════════════ */
    .chat-body {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
      scroll-behavior: smooth;
    }
    .chat-body::-webkit-scrollbar { width: 5px; }
    .chat-body::-webkit-scrollbar-track { background: transparent; }
    .chat-body::-webkit-scrollbar-thumb { background: rgba(0,242,254,0.2); border-radius: 10px; }

    .msg-row { display: flex; gap: 0.5rem; animation: msgFadeIn 0.3s ease-out; }
    .user-row { justify-content: flex-end; }
    @keyframes msgFadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .msg-avatar {
      width: 28px; height: 28px;
      border-radius: 50%;
      background: rgba(0, 242, 254, 0.2);
      color: var(--accent-cyan);
      display: flex; align-items: center; justify-content: center;
      font-size: 16px;
      margin-top: 4px;
      flex-shrink: 0;
    }

    /* ═══════════════════════════════════════════════════════════════
       MESSAGE BUBBLES
       ═══════════════════════════════════════════════════════════════ */
    .msg-bubble {
      max-width: 88%;
      padding: 0.75rem 0.95rem;
      border-radius: 14px;
      font-size: 0.83rem;
      line-height: 1.6;
      overflow-x: auto;
    }
    .ai-bubble {
      background: rgba(31, 41, 55, 0.92);
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

    /* ═══════════════════════════════════════════════════════════════
       TOOL BADGES
       ═══════════════════════════════════════════════════════════════ */
    .tool-badge-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.3rem;
      margin-bottom: 0.5rem;
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

    /* ═══════════════════════════════════════════════════════════════
       PULSING LOADING / TYPING INDICATOR — FIXED
       ═══════════════════════════════════════════════════════════════ */
    .typing-indicator {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 4px;
      min-height: 30px;
    }
    .typing-indicator .dot {
      width: 8px;
      height: 8px;
      background: var(--accent-cyan, #00f2fe);
      border-radius: 50%;
      display: inline-block;
      animation: dotPulse 1.4s infinite ease-in-out both;
    }
    .typing-indicator .dot:nth-child(1) { animation-delay: -0.32s; }
    .typing-indicator .dot:nth-child(2) { animation-delay: -0.16s; }
    .typing-indicator .dot:nth-child(3) { animation-delay: 0s; }
    @keyframes dotPulse {
      0%, 80%, 100% { transform: scale(0.4); opacity: 0.3; }
      40% { transform: scale(1.2); opacity: 1; }
    }

    .font-12 { font-size: 12px; }
    .msg-time { font-size: 0.65rem; opacity: 0.5; display: block; margin-top: 0.4rem; text-align: right; }

    /* ═══════════════════════════════════════════════════════════════
       MARKDOWN BODY — Rich Rendering Styles
       ═══════════════════════════════════════════════════════════════ */
    :host ::ng-deep .markdown-body {
      word-wrap: break-word;
      overflow-wrap: break-word;
    }

    /* Headings */
    :host ::ng-deep .markdown-body .md-h2 {
      font-size: 1.05rem;
      font-weight: 700;
      color: #00f2fe;
      margin: 12px 0 6px 0;
      padding-bottom: 4px;
      border-bottom: 1px solid rgba(0,242,254,0.15);
      font-family: var(--font-heading, inherit);
    }
    :host ::ng-deep .markdown-body .md-h3 {
      font-size: 0.95rem;
      font-weight: 700;
      color: #00f2fe;
      margin: 10px 0 5px 0;
      font-family: var(--font-heading, inherit);
    }
    :host ::ng-deep .markdown-body .md-h4 {
      font-size: 0.88rem;
      font-weight: 600;
      color: #38bdf8;
      margin: 8px 0 4px 0;
    }
    :host ::ng-deep .markdown-body .md-h5 {
      font-size: 0.84rem;
      font-weight: 600;
      color: #7dd3fc;
      margin: 6px 0 3px 0;
    }

    /* Tables — Premium Glassmorphism */
    :host ::ng-deep .markdown-body .md-table-wrapper {
      overflow-x: auto;
      margin: 10px 0;
      border-radius: 10px;
      border: 1px solid rgba(0,242,254,0.2);
      background: rgba(0,0,0,0.25);
    }
    :host ::ng-deep .markdown-body table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.78rem;
      line-height: 1.4;
    }
    :host ::ng-deep .markdown-body thead {
      background: rgba(0,242,254,0.12);
    }
    :host ::ng-deep .markdown-body th {
      padding: 8px 12px;
      text-align: left;
      font-weight: 700;
      color: #00f2fe;
      font-size: 0.76rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      border-bottom: 1px solid rgba(0,242,254,0.25);
      white-space: nowrap;
    }
    :host ::ng-deep .markdown-body td {
      padding: 7px 12px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      color: #e5e7eb;
    }
    :host ::ng-deep .markdown-body tbody tr:hover {
      background: rgba(0,242,254,0.06);
    }
    :host ::ng-deep .markdown-body tbody tr:last-child td {
      border-bottom: none;
    }

    /* Unordered Lists */
    :host ::ng-deep .markdown-body ul.md-list {
      margin: 6px 0;
      padding-left: 1.4rem;
      list-style: none;
    }
    :host ::ng-deep .markdown-body ul.md-list li {
      position: relative;
      padding: 3px 0;
      padding-left: 0.6rem;
      color: #e5e7eb;
    }
    :host ::ng-deep .markdown-body ul.md-list li::before {
      content: '▸';
      position: absolute;
      left: -0.6rem;
      color: #00f2fe;
      font-weight: bold;
    }

    /* Ordered Lists */
    :host ::ng-deep .markdown-body ol.md-olist {
      margin: 6px 0;
      padding-left: 1.4rem;
      counter-reset: md-counter;
      list-style: none;
    }
    :host ::ng-deep .markdown-body ol.md-olist li {
      position: relative;
      padding: 3px 0;
      padding-left: 0.6rem;
      color: #e5e7eb;
      counter-increment: md-counter;
    }
    :host ::ng-deep .markdown-body ol.md-olist li::before {
      content: counter(md-counter) '.';
      position: absolute;
      left: -1rem;
      color: #00f2fe;
      font-weight: 700;
      font-size: 0.78rem;
    }

    /* Horizontal Rule */
    :host ::ng-deep .markdown-body .md-hr {
      border: none;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(0,242,254,0.3), transparent);
      margin: 10px 0;
    }

    /* Inline Code */
    :host ::ng-deep .markdown-body code {
      background: rgba(0,242,254,0.1);
      color: #7dd3fc;
      padding: 0.15rem 0.4rem;
      border-radius: 4px;
      font-size: 0.8rem;
      font-family: 'Fira Code', 'Consolas', monospace;
    }

    /* Blockquote */
    :host ::ng-deep .markdown-body .md-blockquote {
      border-left: 3px solid rgba(0,242,254,0.4);
      padding: 6px 12px;
      margin: 8px 0;
      background: rgba(0,242,254,0.04);
      color: #9ca3af;
      font-style: italic;
    }

    /* Bold and Italic */
    :host ::ng-deep .markdown-body strong { color: #ffffff; font-weight: 700; }
    :host ::ng-deep .markdown-body em { color: #d1d5db; font-style: italic; }

    /* Alert blocks (⚡ notices etc.) */
    :host ::ng-deep .markdown-body .md-alert {
      background: rgba(234, 179, 8, 0.08);
      border: 1px solid rgba(234, 179, 8, 0.25);
      border-radius: 8px;
      padding: 8px 12px;
      margin: 8px 0;
      font-size: 0.8rem;
      color: #fbbf24;
    }

    /* ═══════════════════════════════════════════════════════════════
       SUGGESTION PILLS
       ═══════════════════════════════════════════════════════════════ */
    .chat-suggestions {
      padding: 0.5rem 0.8rem;
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(0, 0, 0, 0.25);
      flex-shrink: 0;
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
      transition: background 0.2s, color 0.2s;
    }
    .sug-pill:hover { background: rgba(0, 242, 254, 0.2); color: white; }

    /* ═══════════════════════════════════════════════════════════════
       CHAT FOOTER / INPUT
       ═══════════════════════════════════════════════════════════════ */
    .chat-footer {
      padding: 0.8rem;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      display: flex;
      gap: 0.5rem;
      flex-shrink: 0;
      background: rgba(0,0,0,0.2);
    }
    .chat-input {
      flex: 1;
      background: rgba(0, 0, 0, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: white;
      padding: 0.6rem 0.9rem;
      border-radius: 20px;
      font-size: 0.82rem;
      transition: border-color 0.2s;
    }
    .chat-input:focus { outline: none; border-color: var(--accent-cyan); }
    .chat-input::placeholder { color: rgba(255,255,255,0.35); }
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
      transition: transform 0.2s, box-shadow 0.2s;
      flex-shrink: 0;
    }
    .send-btn:hover { transform: scale(1.08); box-shadow: 0 4px 16px rgba(0,242,254,0.4); }
  `]
})
export class ChatbotComponent implements AfterViewChecked {
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  isOpen = false;
  isExpanded = false;
  userInput = '';
  private shouldScroll = false;

  session$: Observable<any> = this.authService.currentSession$;
  messages$: Observable<ChatMessage[]> = this.aiService.chatMessages$;
  activeContext$: Observable<any> = this.aiService.activeAppContext$;

  constructor(
    private aiService: AIService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {
    // Subscribe to messages to trigger auto-scroll on changes
    this.messages$.subscribe(() => {
      this.shouldScroll = true;
    });
  }

  ngAfterViewChecked() {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  toggleChat() {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      setTimeout(() => this.scrollToBottom(), 100);
    }
  }

  scrollToBottom(): void {
    try {
      const el = this.scrollContainer.nativeElement;
      el.scrollTop = el.scrollHeight;
    } catch (err) {}
  }

  trackMessage(index: number, msg: ChatMessage): string {
    return index + '-' + msg.sender + '-' + (msg.timestamp?.getTime() || 0);
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

  /**
   * Full Markdown → HTML renderer.
   * Supports: tables, ordered lists, unordered lists, headings (##-#####),
   * horizontal rules, bold, italic, inline code, blockquotes.
   */
  formatMarkdown(text: string): string {
    if (!text) return '';

    const lines = text.split('\n');
    const outputParts: string[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      // ─── HORIZONTAL RULE ───
      if (/^[-*_]{3,}\s*$/.test(trimmed)) {
        outputParts.push('<hr class="md-hr"/>');
        i++;
        continue;
      }

      // ─── TABLE DETECTION ───
      if (trimmed.includes('|') && i + 1 < lines.length && /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(lines[i + 1].trim())) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].trim().includes('|')) {
          tableLines.push(lines[i].trim());
          i++;
        }
        outputParts.push(this.renderTable(tableLines));
        continue;
      }

      // ─── ORDERED LIST (1. 2. 3. etc.) ───
      if (/^\d+[\.\)]\s/.test(trimmed)) {
        const listItems: string[] = [];
        while (i < lines.length && /^\d+[\.\)]\s/.test(lines[i].trim())) {
          listItems.push(lines[i].trim().replace(/^\d+[\.\)]\s/, ''));
          i++;
        }
        outputParts.push('<ol class="md-olist">' + listItems.map(li => `<li>${this.inlineFormat(li)}</li>`).join('') + '</ol>');
        continue;
      }

      // ─── UNORDERED LIST (- or * or •) ───
      if (/^[-*•]\s/.test(trimmed)) {
        const listItems: string[] = [];
        while (i < lines.length && /^[-*•]\s/.test(lines[i].trim())) {
          listItems.push(lines[i].trim().replace(/^[-*•]\s/, ''));
          i++;
        }
        outputParts.push('<ul class="md-list">' + listItems.map(li => `<li>${this.inlineFormat(li)}</li>`).join('') + '</ul>');
        continue;
      }

      // ─── BLOCKQUOTE ───
      if (trimmed.startsWith('>')) {
        const quoteLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('>')) {
          quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
          i++;
        }
        outputParts.push(`<div class="md-blockquote">${this.inlineFormat(quoteLines.join('<br/>'))}</div>`);
        continue;
      }

      // ─── HEADINGS ───
      if (trimmed.startsWith('#####')) {
        outputParts.push(`<div class="md-h5">${this.inlineFormat(trimmed.replace(/^#{5}\s*/, ''))}</div>`);
        i++; continue;
      }
      if (trimmed.startsWith('####')) {
        outputParts.push(`<div class="md-h4">${this.inlineFormat(trimmed.replace(/^#{4}\s*/, ''))}</div>`);
        i++; continue;
      }
      if (trimmed.startsWith('###')) {
        outputParts.push(`<div class="md-h3">${this.inlineFormat(trimmed.replace(/^#{3}\s*/, ''))}</div>`);
        i++; continue;
      }
      if (trimmed.startsWith('##')) {
        outputParts.push(`<div class="md-h2">${this.inlineFormat(trimmed.replace(/^#{2}\s*/, ''))}</div>`);
        i++; continue;
      }

      // ─── ALERT BLOCK (⚡ lines) ───
      if (trimmed.startsWith('⚡')) {
        outputParts.push(`<div class="md-alert">${this.inlineFormat(trimmed)}</div>`);
        i++; continue;
      }

      // ─── EMPTY LINE ───
      if (trimmed === '') {
        outputParts.push('<br/>');
        i++; continue;
      }

      // ─── REGULAR PARAGRAPH ───
      outputParts.push(`<span>${this.inlineFormat(trimmed)}</span><br/>`);
      i++;
    }

    return outputParts.join('');
  }

  /**
   * Inline Markdown formatting: bold, italic, code, and emoji awareness.
   */
  private inlineFormat(text: string): string {
    if (!text) return '';
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>');
  }

  /**
   * Render a Markdown table from pipe-delimited lines into an HTML table
   * with glassmorphism styling wrapper.
   */
  private renderTable(lines: string[]): string {
    if (lines.length < 2) return '';

    const parseCells = (row: string): string[] => {
      return row.split('|')
        .map(c => c.trim())
        .filter(c => c.length > 0);
    };

    const headers = parseCells(lines[0]);
    // lines[1] is the separator row (e.g. |---|---|)
    const bodyRows = lines.slice(2);

    let html = '<div class="md-table-wrapper"><table><thead><tr>';
    for (const h of headers) {
      html += `<th>${this.inlineFormat(h)}</th>`;
    }
    html += '</tr></thead><tbody>';

    for (const row of bodyRows) {
      const cells = parseCells(row);
      html += '<tr>';
      for (let c = 0; c < headers.length; c++) {
        html += `<td>${this.inlineFormat(cells[c] || '')}</td>`;
      }
      html += '</tr>';
    }

    html += '</tbody></table></div>';
    return html;
  }
}
