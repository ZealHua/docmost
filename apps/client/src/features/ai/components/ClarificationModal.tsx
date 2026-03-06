import { useEffect, useState } from 'react';
import { IconSparkles } from '@tabler/icons-react';
import styles from './ClarificationModal.module.css';

interface ClarificationModalProps {
  opened: boolean;
  onClose: () => void;
  onSubmit: (answer: string) => void;
  questions?: Array<{
    id: string;
    question: string;
    options?: string[];
    required?: boolean;
  }>;
  context?: string;
  round: number;
}

export function ClarificationModal({
  opened,
  onClose,
  onSubmit,
  questions,
  context,
  round,
}: ClarificationModalProps) {
  const activeQuestions = questions || [];

  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!opened) return;
    setSelectedOptions({});
    setCustomAnswers({});
  }, [opened]);

  // Lock body scroll when open
  useEffect(() => {
    if (!opened) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [opened]);

  if (activeQuestions.length === 0 || !opened) return null;

  const getFinalAnswer = (questionId: string) =>
    selectedOptions[questionId] || customAnswers[questionId] || '';

  const handleSubmit = () => {
    const lines = activeQuestions
      .map((item, index) => {
        const answer = getFinalAnswer(item.id).trim();
        return answer
          ? `Q${index + 1}: ${item.question.trim()}\nAnswer: ${answer}`
          : '';
      })
      .filter(Boolean);

    if (lines.length === 0) return;

    onSubmit(`Clarification details:\n${lines.join('\n\n')}`);
    setSelectedOptions({});
    setCustomAnswers({});
  };

  const isSubmitDisabled = activeQuestions.some(item => {
    const answer = getFinalAnswer(item.id).trim();
    return (item.required ?? true) && !answer;
  });

  const helperText = round > 0
    ? 'Final clarification before research continues.'
    : 'Answer all questions below before research continues.';

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        {/* Decorative elements */}
        <span className={`${styles.corner} ${styles.cornerTL}`} />
        <span className={`${styles.corner} ${styles.cornerTR}`} />
        <span className={`${styles.corner} ${styles.cornerBL}`} />
        <span className={`${styles.corner} ${styles.cornerBR}`} />

        <div className={styles.inner}>
          {/* Header */}
          <div className={styles.header}>
            <div className={styles.headerIcon}>
              <IconSparkles size={16} />
            </div>
            <span className={styles.headerTitle}>Deep Research</span>
            <span className={styles.headerBadge}>Clarification</span>
          </div>

          {/* Helper text */}
          <p className={styles.helperText}>{helperText}</p>

          {/* Context card */}
          <div className={styles.contextCard}>
            <div className={styles.contextLabel}>Context</div>
            <div className={styles.contextText}>
              {context || 'A few details are needed before research begins.'}
            </div>
          </div>

          {/* Questions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {activeQuestions.map((item, index) => (
              <div key={item.id} className={styles.questionBlock}>
                <div className={styles.questionNumber}>{index + 1}</div>
                <div className={styles.questionText}>{item.question}</div>

                {/* Option chips */}
                {item.options && item.options.length > 0 && (
                  <div className={styles.chipRow}>
                    {item.options.map((option) => (
                      <button
                        key={option}
                        type="button"
                        className={`${styles.chip} ${
                          selectedOptions[item.id] === option ? styles.chipSelected : ''
                        }`}
                        onClick={() => {
                          setSelectedOptions(prev => ({ ...prev, [item.id]: option }));
                          setCustomAnswers(prev => ({ ...prev, [item.id]: '' }));
                        }}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                )}

                {/* Custom answer */}
                <div className={styles.customAnswerLabel}>
                  {item.options && item.options.length > 0
                    ? 'Or provide a custom answer'
                    : 'Your answer'}
                </div>
                <textarea
                  className={styles.customInput}
                  value={customAnswers[item.id] || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setCustomAnswers(prev => ({ ...prev, [item.id]: value }));
                    if (value.trim()) {
                      setSelectedOptions(prev => ({ ...prev, [item.id]: '' }));
                    }
                  }}
                  placeholder="Type your answer here…"
                  rows={3}
                />
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className={styles.divider} />

          {/* Footer */}
          <div className={styles.footer}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.submitButton}
              onClick={handleSubmit}
              disabled={isSubmitDisabled}
            >
              Continue Research
              <span className={styles.submitArrow}>→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
