import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import Joyride, {
  ACTIONS,
  EVENTS,
  STATUS,
  type CallBackProps,
  type Step,
  type TooltipRenderProps,
} from 'react-joyride';
import { setGuidedTourActive } from '../utils/ux';

type GuidedTourProps = {
  storageKey: string;
  steps: Step[];
  autoStart?: boolean;
  isBlocked?: boolean;
};

function resolveTarget(target: Step['target']): HTMLElement | null {
  if (!target) return null;

  if (typeof target === 'string') {
    return document.querySelector(target) as HTMLElement | null;
  }

  if (target instanceof HTMLElement) {
    return target;
  }

  return null;
}

function scrollTargetIntoView(step?: Step, behavior: ScrollBehavior = 'smooth') {
  if (!step) return;

  const targetEl = resolveTarget(step.target);
  if (!targetEl) return;

  targetEl.scrollIntoView({
    behavior,
    block: 'center',
    inline: 'nearest',
  });
}

type FixedTooltipProps = TooltipRenderProps & {
  isMobile: boolean;
  onFocusTarget: () => void;
};

function FixedTooltip({
  backProps,
  closeProps,
  continuous,
  index,
  isLastStep,
  primaryProps,
  skipProps,
  step,
  size,
  isMobile,
  onFocusTarget,
}: FixedTooltipProps) {
  if (typeof document === 'undefined') return null;

  const shellStyle: CSSProperties = isMobile
    ? {
        position: 'fixed',
        left: 12,
        right: 12,
        bottom: 'max(12px, env(safe-area-inset-bottom))',
        zIndex: 10001,
        maxHeight: 'min(52vh, 430px)',
        overflowY: 'auto',
        borderRadius: 24,
        background: '#ffffff',
        boxShadow: '0 18px 40px rgba(0,0,0,0.22)',
        padding: 18,
      }
    : {
        position: 'fixed',
        right: 20,
        bottom: 20,
        zIndex: 10001,
        width: 'min(430px, calc(100vw - 40px))',
        maxHeight: 'min(58vh, 520px)',
        overflowY: 'auto',
        borderRadius: 24,
        background: '#ffffff',
        boxShadow: '0 22px 55px rgba(0,0,0,0.20)',
        padding: 20,
      };

  const ghostButtonStyle: CSSProperties = {
    border: 0,
    outline: 0,
    cursor: 'pointer',
    background: '#eef2f7',
    color: '#475569',
    borderRadius: 14,
    padding: '10px 14px',
    fontWeight: 800,
    fontSize: 14,
    transition: 'all .18s ease',
  };

  const primaryButtonStyle: CSSProperties = {
    border: 0,
    outline: 0,
    cursor: 'pointer',
    background: '#3483fa',
    color: '#ffffff',
    borderRadius: 14,
    padding: '10px 16px',
    fontWeight: 800,
    fontSize: 14,
    boxShadow: '0 10px 22px rgba(52,131,250,0.24)',
    transition: 'all .18s ease',
  };

  const closeButtonStyle: CSSProperties = {
    border: 0,
    outline: 0,
    cursor: 'pointer',
    width: 38,
    height: 38,
    minWidth: 38,
    borderRadius: 999,
    background: '#f1f5f9',
    color: '#64748b',
    fontSize: 20,
    fontWeight: 700,
  };

  return createPortal(
    <div style={shellStyle}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          {step.title ? (
            <div
              style={{
                fontSize: isMobile ? 20 : 24,
                fontWeight: 800,
                lineHeight: 1.18,
                color: '#172033',
                marginBottom: 8,
              }}
            >
              {step.title}
            </div>
          ) : null}

          <div
            style={{
              fontSize: 15,
              lineHeight: 1.72,
              color: '#334155',
            }}
          >
            {step.content}
          </div>
        </div>

        <button
          {...closeProps}
          type="button"
          style={closeButtonStyle}
          aria-label="Cerrar tutorial"
        >
          ×
        </button>
      </div>

      <div
        style={{
          marginTop: 14,
          paddingTop: 14,
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 800,
            color: '#64748b',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          Paso {index + 1} de {size}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
            marginLeft: 'auto',
          }}
        >
          <button
            {...skipProps}
            type="button"
            style={ghostButtonStyle}
          >
            Saltar
          </button>

          <button
            type="button"
            onClick={onFocusTarget}
            style={ghostButtonStyle}
          >
            Ver paso
          </button>

          {index > 0 ? (
            <button
              {...backProps}
              type="button"
              style={ghostButtonStyle}
            >
              Atrás
            </button>
          ) : null}

          <button
            {...primaryProps}
            type="button"
            style={primaryButtonStyle}
          >
            {continuous
              ? isLastStep
                ? 'Entendido'
                : `Siguiente (${index + 1} de ${size})`
              : primaryProps.title}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function GuidedTour({
  storageKey,
  steps,
  autoStart = true,
  isBlocked = false,
}: GuidedTourProps) {
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false,
  );

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (isBlocked && run) {
      setRun(false);
      setGuidedTourActive(false);
    }
  }, [isBlocked, run]);

  useEffect(() => {
    const alreadySeen = localStorage.getItem(storageKey) === '1';

    if (alreadySeen) return;
    if (!autoStart) return;
    if (!steps.length) return;
    if (isBlocked) return;
    if (run) return;

    const timer = window.setTimeout(() => {
      setStepIndex(0);
      setRun(true);
      setGuidedTourActive(true);
    }, 500);

    return () => window.clearTimeout(timer);
  }, [storageKey, autoStart, steps.length, isBlocked, run]);

  useEffect(() => {
    setGuidedTourActive(run);

    return () => {
      setGuidedTourActive(false);
    };
  }, [run]);

  useEffect(() => {
    if (!run) return;

    document.body.style.overscrollBehavior = 'contain';

    return () => {
      document.body.style.overscrollBehavior = '';
    };
  }, [run]);

  useEffect(() => {
    if (!run || isBlocked || !steps[stepIndex]) return;

    scrollTargetIntoView(steps[stepIndex], 'smooth');

    const t1 = window.setTimeout(() => {
      scrollTargetIntoView(steps[stepIndex], 'smooth');
    }, 180);

    const t2 = window.setTimeout(() => {
      scrollTargetIntoView(steps[stepIndex], 'smooth');
    }, 420);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [run, stepIndex, steps, isBlocked]);

  const safeSteps = useMemo(() => {
    return steps.map((step, idx) => {
      if (!run || idx !== stepIndex) return step;

      const targetEl = resolveTarget(step.target);
      if (!targetEl) return step;

      const rect = targetEl.getBoundingClientRect();
      const wantedPlacement = step.placement ?? 'bottom';

      if (!isMobile) {
        if (wantedPlacement === 'top' && rect.top < 220) {
          return { ...step, placement: 'bottom' as const };
        }

        if (wantedPlacement === 'left' && rect.left < 380) {
          return { ...step, placement: 'bottom' as const };
        }

        if (wantedPlacement === 'right' && window.innerWidth - rect.right < 380) {
          return { ...step, placement: 'bottom' as const };
        }

        if (wantedPlacement === 'bottom' && window.innerHeight - rect.bottom < 180) {
          return { ...step, placement: 'top' as const };
        }
      }

      return step;
    });
  }, [steps, run, stepIndex, isMobile]);

  const finishTour = useCallback(() => {
    localStorage.setItem(storageKey, '1');
    setRun(false);
    setStepIndex(0);
    setGuidedTourActive(false);
  }, [storageKey]);

  const handleCallback = useCallback(
    (data: CallBackProps) => {
      if (data.status === STATUS.FINISHED || data.status === STATUS.SKIPPED) {
        finishTour();
        return;
      }

      if (data.action === ACTIONS.CLOSE) {
        finishTour();
        return;
      }

      if (data.type === EVENTS.TOUR_END) {
        setRun(false);
        setGuidedTourActive(false);
        return;
      }

      if (data.type === EVENTS.TARGET_NOT_FOUND) {
        const nextIndex =
          data.action === ACTIONS.PREV ? data.index - 1 : data.index + 1;

        if (nextIndex >= 0 && nextIndex < steps.length) {
          setStepIndex(nextIndex);
        } else {
          finishTour();
        }
        return;
      }

      if (data.type === EVENTS.STEP_AFTER) {
        const nextIndex =
          data.action === ACTIONS.PREV ? data.index - 1 : data.index + 1;

        if (nextIndex >= 0 && nextIndex < steps.length) {
          setStepIndex(nextIndex);
        } else {
          finishTour();
        }
      }
    },
    [finishTour, steps.length],
  );

  if (!steps.length || isBlocked) return null;

  return (
    <Joyride
      steps={safeSteps}
      run={run}
      stepIndex={stepIndex}
      callback={handleCallback}
      continuous
      showSkipButton
      showProgress
      disableOverlayClose
      disableCloseOnEsc={false}
      scrollToFirstStep
      scrollDuration={320}
      scrollOffset={isMobile ? 90 : 110}
      spotlightPadding={12}
      disableScrolling={false}
      disableScrollParentFix={true}
      spotlightClicks={false}
      floaterProps={{
        hideArrow: true,
        offset: 8,
        styles: {
          options: {
            zIndex: 9999,
          },
        },
      }}
      tooltipComponent={(props) => (
        <FixedTooltip
          {...props}
          isMobile={isMobile}
          onFocusTarget={() => scrollTargetIntoView(safeSteps[stepIndex], 'smooth')}
        />
      )}
      locale={{
        back: 'Atrás',
        close: 'Cerrar',
        last: 'Entendido',
        next: 'Siguiente',
        nextLabelWithProgress: 'Siguiente ({step} de {steps})',
        open: 'Abrir',
        skip: 'Saltar',
      }}
      styles={{
        options: {
          zIndex: 9999,
          primaryColor: '#3483fa',
          backgroundColor: 'transparent',
          textColor: '#172033',
          arrowColor: 'transparent',
          overlayColor: 'rgba(0,0,0,0.32)',
        },
        tooltip: {
          backgroundColor: 'transparent',
          borderRadius: 0,
          boxShadow: 'none',
          padding: 0,
        },
        tooltipContainer: {
          textAlign: 'left',
          padding: 0,
          margin: 0,
        },
        tooltipTitle: {
          fontSize: '1px',
          margin: 0,
        },
        tooltipContent: {
          fontSize: '1px',
          margin: 0,
          padding: 0,
        },
        buttonNext: {
          display: 'none',
        },
        buttonBack: {
          display: 'none',
        },
        buttonSkip: {
          display: 'none',
        },
        buttonClose: {
          display: 'none',
        },
        spotlight: {
          borderRadius: 24,
        },
      }}
    />
  );
}