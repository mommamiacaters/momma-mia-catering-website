import React, { useState, useEffect, useRef } from "react";
import ServiceOptions from "./components/ServiceOptions";
import MealList from "./components/MealList";

interface Message {
  text: string;
  sender: "user" | "bot";
  id: number;
}

interface MealItem {
  name: string;
  price: string;
}

interface ChatbotProps {
  webhookUrl?: string;
  className?: string;
}

const Chatbot: React.FC<ChatbotProps> = ({
  webhookUrl = "http://localhost:5678/webhook/momma-mia-chat",
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [showBadge, setShowBadge] = useState(true);
  const [showQuickOptions, setShowQuickOptions] = useState(true);
  const [context, setContext] = useState({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatWidgetRef = useRef<HTMLDivElement>(null);
  const messageIdCounter = useRef(0);

  const mealData = {
    "check-a-lunch": [
      { name: "Chicken Adobo Meal", price: "₱650" },
      { name: "Beef Caldereta Meal", price: "₱750" },
      { name: "Pork Sisig Meal", price: "₱700" },
      { name: "Fish Fillet Meal", price: "₱680" },
      { name: "Vegetable Spring Rolls Meal", price: "₱600" },
    ],
    "fun-boxes": [
      { name: "Mini Pancit Canton Box", price: "₱800" },
      { name: "Chicken BBQ Skewers Box", price: "₱900" },
      { name: "Lumpia Shanghai Box", price: "₱750" },
      { name: "Mixed Rice Bowls Box", price: "₱850" },
      { name: "Assorted Sandwiches Box", price: "₱700" },
      { name: "Filipino Snacks Mix Box", price: "₱650" },
    ],
  };

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

  const callWebhook = async (message: string) => {
    setIsLoading(true);

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        mode: "cors",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          message: message,
          context: context,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `HTTP error! status: ${response.status}, message: ${errorText}`
        );
      }

      const responseText = await response.text();
      const data = JSON.parse(responseText);

      if (data.context) {
        setContext({ ...context, ...data.context });
      }

      return data;
    } catch (error) {
      console.error("Webhook call failed:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const message = inputValue.trim();
    setInputValue("");
    addMessage(message, "user");

    setIsTyping(true);

    try {
      const response = await callWebhook(message);
      setIsTyping(false);

      if (response && response.response) {
        addMessage(response.response, "bot");
      } else {
        addMessage(
          "Sorry, I had trouble understanding that. Could you try asking again?",
          "bot"
        );
      }
    } catch (error) {
      setIsTyping(false);
      addMessage(
        "Oops! Something went wrong. Please try again in a moment. 🤔",
        "bot"
      );
    }
  };

  const handleQuickOption = async (message: string) => {
    addMessage(message, "user");
    setShowQuickOptions(false);

    if (message.includes("start an order")) {
      showServiceOptions();
      return;
    }

    setIsTyping(true);

    try {
      const response = await callWebhook(message);
      setIsTyping(false);

      if (response && response.response) {
        addMessage(response.response, "bot");
      } else {
        addMessage(
          "Sorry, I had trouble understanding that. Could you try asking again?",
          "bot"
        );
      }
    } catch (error) {
      setIsTyping(false);
      addMessage(
        "Oops! Something went wrong. Please try again in a moment. 🤔",
        "bot"
      );
    }
  };

  const showServiceOptions = () => {
    addMessage("Great! Which service would you like to order from?", "bot");
    // Service options would be handled through custom message components
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Close widget when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isOpen &&
        chatWidgetRef.current &&
        !chatWidgetRef.current.contains(event.target as Node) &&
        !(event.target as Element).closest("button[data-chat-toggle]") // Exclude chat button
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const [showServiceSelection, setShowServiceSelection] = useState(false);
  const [showMealSelection, setShowMealSelection] = useState<{
    service: keyof typeof mealData;
    serviceName: string;
  } | null>(null);

  const handleServiceSelect = (
    service: keyof typeof mealData,
    serviceName: string
  ) => {
    setShowServiceSelection(false);
    addMessage(`Here are our ${serviceName} options:`, "bot");
    setShowMealSelection({ service, serviceName });
  };

  const handleMealContinue = () => {
    setShowMealSelection(null);
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      addMessage(
        `Perfect! I'll help you customize your order. How many meals do you need and for what date?`,
        "bot"
      );
    }, 1500);
  };

  useEffect(() => {
    if (messages.length === 0 && showQuickOptions) {
      // Don't add welcome message automatically, let parent handle it
    }
  }, []);

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
        {isOpen ? "×" : "🗪"}
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
            <button
              onClick={closeWidget}
              className="bg-white/20 border-none text-white w-8 h-8 rounded-full cursor-pointer flex items-center justify-center text-xl transition-colors duration-300 hover:bg-white/30"
            >
              ×
            </button>
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
                    onClick={() =>
                      handleQuickOption("I want to see your services and FAQs")
                    }
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
                        "Great! Which service would you like to order from?",
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
                <ServiceOptions
                  onSelect={handleServiceSelect}
                  addMessage={addMessage}
                />
              </div>
            )}

            {/* Meal Selection */}
            {showMealSelection && (
              <div className="self-start w-full">
                <MealList
                  service={showMealSelection.service}
                  serviceName={showMealSelection.serviceName}
                  onContinue={handleMealContinue}
                  addMessage={addMessage}
                />
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
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                rows={1}
                className="flex-1 py-3 px-4 border-2 border-brand-divider rounded-3xl text-sm resize-none font-poppins h-11 min-h-11 max-h-11 transition-colors duration-300 text-brand-text overflow-hidden leading-tight focus:outline-none focus:border-brand-primary"
                style={{ lineHeight: "1.2" }}
              />
              <button
                onClick={sendMessage}
                disabled={isLoading}
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
