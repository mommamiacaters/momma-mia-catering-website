import React, { useState, useEffect, useRef, useCallback } from "react";
import ServiceOptions from "./components/ServiceOptions";

interface Message {
  text: string;
  sender: "user" | "bot";
  id: number;
}

interface WebhookResponse {
  response?: string;
  status?: string;
  context?: Record<string, unknown>;
  intents?: string[];
  leadScore?: {
    score: number;
    level: string;
    priority: string;
    reasoning: string;
  };
}

interface ChatbotProps {
  webhookUrl?: string;
  className?: string;
}

const SERVICES_FAQ_RESPONSE = `Here's what Momma Mia Catering is all about!

📖 About Us
Momma Mia Catering brings homestyle cooking and warm hospitality to your events and everyday meals. Good food brings people together!

🍽️ Our Services
• Check-A-Lunch — Fresh, healthy lunch options delivered daily to your workplace or event
• Party Trays — Delicious assortments perfect for celebrations and gatherings
• Fun Boxes — Individual meal boxes packed with flavor and fun
• Catering Services — Full-service catering for weddings, corporate events, and special occasions
• Equipment Rental — Professional-grade catering equipment for rent

❓ FAQs
Q: How do I place an order?
A: Click "Start Order" to browse our Check-a-Lunch menu, or click "Get A Quote" for custom catering!

Q: How far in advance should I order?
A: We recommend ordering at least 48 hours in advance. For large events, please contact us 1-2 weeks ahead.

Q: Do you deliver?
A: Yes! We deliver within our service area. Contact us for delivery details.

Q: Can I customize my order?
A: Absolutely! We love working with you to create the perfect menu for your needs.

Feel free to type a message if you have more questions!`;

const Chatbot: React.FC<ChatbotProps> = ({
  webhookUrl = `${
    import.meta.env.VITE_N8N_BASE_URL || import.meta.env.VITE_N8N_LOCAL
  }/webhook/momma-mia-chat`,
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [showBadge, setShowBadge] = useState(true);
  const [showQuickOptions, setShowQuickOptions] = useState(true);
  const [context, setContext] = useState<Record<string, unknown>>({});
  const [showServiceSelection, setShowServiceSelection] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatWidgetRef = useRef<HTMLDivElement>(null);
  const messageIdCounter = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const addMessage = (text: string, sender: "user" | "bot") => {
    const newMessage: Message = {
      text,
      sender,
      id: messageIdCounter.current++,
    };
    setMessages((prev) => [...prev, newMessage]);
    scrollToBottom();
  };

  const toggleWidget = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newIsOpen = !isOpen;
    setIsOpen(newIsOpen);
    if (newIsOpen) {
      setShowBadge(false);
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  };

  const closeWidget = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
  };

  const callWebhook = useCallback(
    async (message: string): Promise<WebhookResponse> => {
      // Cancel any in-flight request
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsLoading(true);

      try {
        const response = await fetch(webhookUrl, {
          method: "POST",
          mode: "cors",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            message,
            context,
            timestamp: new Date().toISOString(),
          }),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => "");
          throw new Error(
            `HTTP error! status: ${response.status}, message: ${errorText}`
          );
        }

        const responseText = await response.text();
        if (!responseText.trim()) {
          throw new Error("Empty response from server");
        }

        const data: WebhookResponse = JSON.parse(responseText);

        // Replace context with what n8n returns (it manages full conversation state)
        if (data.context) {
          setContext(data.context);
        }

        return data;
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          throw error; // Don't log aborted requests
        }
        console.error("Webhook call failed:", error);
        throw error;
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [webhookUrl, context]
  );

  const handleBotResponse = (data: WebhookResponse) => {
    if (data.status === "success" && data.response) {
      addMessage(data.response, "bot");
    } else if (data.response) {
      addMessage(data.response, "bot");
    } else {
      addMessage(
        "Sorry, I had trouble understanding that. Could you try asking again?",
        "bot"
      );
    }

    // Re-show quick options after quote is submitted
    if (data.context && (data.context as Record<string, unknown>).quoteSent === true) {
      setTimeout(() => setShowQuickOptions(true), 500);
    }
  };

  const handleWebhookError = (error: unknown) => {
    if ((error as Error).name === "AbortError") return; // Silently ignore cancelled requests
    addMessage(
      "Oops! Something went wrong. Please try again in a moment.",
      "bot"
    );
  };

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const message = inputValue.trim();
    setInputValue("");
    setShowQuickOptions(false);
    addMessage(message, "user");

    setIsTyping(true);

    try {
      const data = await callWebhook(message);
      setIsTyping(false);
      handleBotResponse(data);
    } catch (error) {
      setIsTyping(false);
      handleWebhookError(error);
    }
  };

  const handleQuickOption = async (message: string) => {
    addMessage(message, "user");
    setShowQuickOptions(false);

    setIsTyping(true);

    try {
      const data = await callWebhook(message);
      setIsTyping(false);
      handleBotResponse(data);
    } catch (error) {
      setIsTyping(false);
      handleWebhookError(error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Cancel in-flight requests on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Close widget when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isOpen &&
        chatWidgetRef.current &&
        !chatWidgetRef.current.contains(event.target as Node) &&
        !(event.target as Element).closest("button[data-chat-toggle]")
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className={`fixed z-50 ${className}`}>
      {/* Chat Button */}
      <button
        onClick={toggleWidget}
        data-chat-toggle
        className={`fixed bottom-8 right-8 w-15 h-15 bg-gradient-to-br from-brand-primary to-brand-accent rounded-full border-none cursor-pointer shadow-lg shadow-brand-primary/40 transition-all duration-300 z-[1000] flex items-center justify-center text-white text-3xl hover:scale-110 hover:shadow-xl hover:shadow-brand-primary/50 active:scale-95 md:bottom-8 md:right-8 ${
          isOpen ? "max-md:hidden" : ""
        }`}
        style={{ width: "60px", height: "60px" }}
      >
        {isOpen ? (
          <i className="pi pi-times text-xl"></i>
        ) : (
          <i className="pi pi-comments text-xl"></i>
        )}
        {showBadge && !isOpen && (
          <div className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center font-bold animate-pulse">
            1
          </div>
        )}
      </button>

      {/* Chat Widget */}
      {isOpen && (
        <div
          ref={chatWidgetRef}
          className="fixed bottom-28 right-8 w-96 h-[600px] bg-white rounded-3xl shadow-2xl shadow-stone-700/20 border-2 border-brand-divider flex flex-col overflow-hidden z-[999] chat-widget-animate md:w-96 md:h-[600px] md:bottom-28 md:right-8 max-md:fixed max-md:top-0 max-md:left-0 max-md:right-0 max-md:bottom-0 max-md:w-full max-md:h-full max-md:rounded-none max-md:border-none"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-brand-primary to-brand-accent p-5 text-white relative flex items-center justify-between">
            <div>
              <h2 className="text-xl mb-0.5 font-arvo">
                🍝 Momma Mia Catering
              </h2>
              <p className="text-sm opacity-90 font-poppins">
                Good food brings people together ❤️
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={closeWidget}
                className="bg-white/20 border-none text-white w-8 h-8 rounded-full cursor-pointer flex items-center justify-center text-xl transition-colors duration-300 hover:bg-white/30"
              >
                ×
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 p-5 overflow-y-auto bg-brand-secondary flex flex-col gap-4">
            {/* Welcome Message */}
            {showQuickOptions && (
              <>
                <div className="text-center text-brand-text italic py-5 px-4 text-sm leading-relaxed bg-gradient-to-r from-brand-primary to-brand-accent bg-clip-text text-transparent font-arvo">
                  👋 Hi! I'm here to help you with Momma Mia Catering!
                  <br />
                  Choose an option below to get started:
                </div>
                <div className="flex flex-col gap-2.5 mt-2.5 w-full animate-in fade-in duration-500">
                  <button
                    onClick={() => {
                      addMessage("I want to see your services and FAQs", "user");
                      setShowQuickOptions(false);
                      addMessage(SERVICES_FAQ_RESPONSE, "bot");
                    }}
                    className="bg-gradient-to-r from-brand-primary to-brand-accent text-white border-none py-3 px-6 rounded-3xl cursor-pointer text-sm font-medium transition-all duration-300 shadow-lg shadow-brand-primary/30 flex items-center gap-2 text-left hover:translate-y-[-2px] hover:shadow-xl hover:shadow-brand-primary/40 active:translate-y-0 font-poppins"
                  >
                    <span className="text-lg min-w-[20px]">📋</span>
                    <span>Services & FAQs</span>
                  </button>
                  <button
                    onClick={() => {
                      addMessage("I want to start an order", "user");
                      setShowQuickOptions(false);
                      addMessage(
                        "Great! Choose a service below to get started:",
                        "bot"
                      );
                      setShowServiceSelection(true);
                    }}
                    className="bg-gradient-to-r from-brand-primary to-brand-accent text-white border-none py-3 px-6 rounded-3xl cursor-pointer text-sm font-medium transition-all duration-300 shadow-lg shadow-brand-primary/30 flex items-center gap-2 text-left hover:translate-y-[-2px] hover:shadow-xl hover:shadow-brand-primary/40 active:translate-y-0 font-poppins"
                  >
                    <span className="text-lg min-w-[20px]">🛒</span>
                    <span>Start Order</span>
                  </button>
                  <button
                    onClick={() =>
                      handleQuickOption("I want to get a quote for my event")
                    }
                    className="bg-gradient-to-r from-brand-primary to-brand-accent text-white border-none py-3 px-6 rounded-3xl cursor-pointer text-sm font-medium transition-all duration-300 shadow-lg shadow-brand-primary/30 flex items-center gap-2 text-left hover:translate-y-[-2px] hover:shadow-xl hover:shadow-brand-primary/40 active:translate-y-0 font-poppins"
                  >
                    <span className="text-lg min-w-[20px]">💰</span>
                    <span>Get A Quote</span>
                  </button>
                </div>
              </>
            )}

            {/* Regular Messages */}
            {messages.map((message) => (
              <div
                key={message.id}
                className={`max-w-[85%] py-3 px-4 rounded-2xl text-sm leading-relaxed animate-in fade-in slide-in-from-bottom-2 duration-300 font-poppins ${
                  message.sender === "user"
                    ? "bg-gradient-to-r from-brand-primary to-brand-accent text-white self-end rounded-br-md"
                    : "bg-white text-brand-text self-start rounded-bl-md border border-brand-divider whitespace-pre-line"
                }`}
              >
                {message.text}
              </div>
            ))}

            {/* Service Selection */}
            {showServiceSelection && (
              <div className="self-start w-full">
                <ServiceOptions addMessage={addMessage} />
              </div>
            )}

            {/* Typing Indicator */}
            {isTyping && (
              <div className="self-start py-3 px-4 bg-white rounded-2xl rounded-bl-md border border-brand-divider max-w-[85%]">
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-brand-primary animate-bounce [animation-delay:0ms]"></span>
                  <span className="w-2 h-2 rounded-full bg-brand-primary animate-bounce [animation-delay:200ms]"></span>
                  <span className="w-2 h-2 rounded-full bg-brand-primary animate-bounce [animation-delay:400ms]"></span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-5 bg-white border-t border-brand-divider flex-shrink-0">
            <div className="flex gap-2.5 items-end">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message..."
                disabled={isLoading || isTyping}
                rows={1}
                className="flex-1 py-3 px-4 border-2 border-brand-divider rounded-3xl text-sm resize-none font-poppins h-11 min-h-11 max-h-11 transition-colors duration-300 text-brand-text overflow-hidden leading-tight focus:outline-none focus:border-brand-primary disabled:opacity-60"
                style={{ lineHeight: "1.2" }}
              />
              <button
                onClick={sendMessage}
                disabled={isLoading || isTyping}
                className="w-11 h-11 bg-gradient-to-r from-brand-primary to-brand-accent border-none rounded-full text-white cursor-pointer flex items-center justify-center transition-all duration-200 text-lg flex-shrink-0 hover:scale-105 hover:shadow-md hover:shadow-brand-primary/40 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
              >
                ➤
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Chatbot;
