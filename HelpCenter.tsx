import React from "react";
import { HelpCircle, Mail, ChevronRight, Briefcase, CheckCircle2, DollarSign, Send, Wallet } from "lucide-react";
import { motion } from "motion/react";

export default function HelpCenter() {
  const faqs = [
    {
      question: "How do I post a project?",
      answer: "Go to the Feed page and click the 'Post a Project' button at the top right. Fill in the details and publish it.",
      icon: <Briefcase className="text-indigo-600" size={20} />
    },
    {
      question: "How do I accept a project?",
      answer: "Browse the Feed page. When you find a project you like, click the 'Accept' button on the project card.",
      icon: <CheckCircle2 className="text-emerald-600" size={20} />
    },
    {
      question: "How do I create a milestone?",
      answer: "Open a chat thread for your project. Click the 'Add Milestone' button in the chat header or actions menu.",
      icon: <Send className="text-blue-600" size={20} />
    },
    {
      question: "How do I pay?",
      answer: "Once a milestone is created by the freelancer, a 'Pay' button will appear. Click it to initiate the payment process.",
      icon: <DollarSign className="text-amber-600" size={20} />
    },
    {
      question: "How do I deliver work?",
      answer: "After the client has paid for a milestone, you can click the 'Send' button on that milestone to deliver your work.",
      icon: <CheckCircle2 className="text-purple-600" size={20} />
    },
    {
      question: "How do I get paid?",
      answer: "Your earnings will appear on the Earnings page once a milestone is completed. You can withdraw your funds via Stripe.",
      icon: <Wallet className="text-rose-600" size={20} />
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 pb-24 transition-colors duration-200">
      <header className="mb-12 text-center">
        <div className="mb-4 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-indigo-600 text-white shadow-xl shadow-indigo-200">
            <HelpCircle size={32} />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Help Center</h1>
        <p className="mt-2 text-gray-500">Find answers to common questions</p>
      </header>

      <div className="mx-auto max-w-2xl space-y-4">
        {faqs.map((faq, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="overflow-hidden rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-100"
          >
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-50">
                {faq.icon}
              </div>
              <h3 className="font-bold text-gray-900">{faq.question}</h3>
            </div>
            <p className="text-sm leading-relaxed text-gray-500">
              {faq.answer}
            </p>
          </motion.div>
        ))}

        <div className="mt-12 rounded-[32px] bg-indigo-600 p-8 text-center text-white shadow-xl shadow-indigo-200">
          <h3 className="mb-2 text-xl font-bold">Still need help?</h3>
          <p className="mb-6 text-indigo-100">Our support team is here to assist you with any issues.</p>
          <a
            href="mailto:flowthread@gmail.com"
            className="inline-flex items-center gap-2 rounded-2xl bg-white px-8 py-4 font-bold text-indigo-600 transition-all active:scale-95"
          >
            <Mail size={20} />
            Email us at flowthread@gmail.com
          </a>
        </div>
      </div>
    </div>
  );
}
