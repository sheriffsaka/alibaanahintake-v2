
import React, { useState } from 'react'
import { Plus, Minus } from 'lucide-react'
import { useTranslation } from '../../i18n/LanguageContext'

const FaqItem: React.FC<{
  faq: { question: string; answer: string }
  isOpen: boolean
  onClick: () => void
}> = ({ faq, isOpen, onClick }) => {
  return (
    <div className="border-b border-white/20">
      <button
        onClick={onClick}
        className="w-full flex justify-between items-center text-left rtl:text-right py-5 px-4"
      >
        <span className="text-lg font-medium text-white">{faq.question}</span>
        {isOpen ? <Minus className="h-6 w-6 text-brand-yellow" /> : <Plus className="h-6 w-6 text-white/70" />}
      </button>
      <div
        className={`grid overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <p className="text-gray-300 pb-5 px-4">{faq.answer}</p>
        </div>
      </div>
    </div>
  )
}

const Faq: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const { t } = useTranslation()

  const faqData = [
    {
      question: t('faq1Question'),
      answer: t('faq1Answer'),
    },
    {
      question: t('faq2Question'),
      answer: t('faq2Answer'),
    },
    {
      question: t('faq3Question'),
      answer: t('faq3Answer'),
    },
  ]

  return (
    <section id="faq" className="py-20 bg-brand-green-dark">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white">{t('faqTitle')}</h2>
           <div className="h-1 w-16 bg-brand-yellow mx-auto mt-4 mb-12"></div>
        </div>
        <div className="max-w-3xl mx-auto bg-white/5 rounded-lg border border-white/10">
          {faqData.map((faq, index) => (
            <FaqItem
              key={index}
              faq={faq}
              isOpen={openIndex === index}
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

export default Faq
