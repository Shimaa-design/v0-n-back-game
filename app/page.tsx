"use client"

import { useState, useEffect, useRef } from "react"
import { Volume2, Info, TrendingUp, X, Minus, Plus } from "lucide-react"

export const dynamic = "force-dynamic"

const getStimulusColor = (colorName: string) => {
  const colorMap: Record<string, string> = {
    red: "var(--stimulus-red)",
    blue: "var(--stimulus-blue)",
    green: "var(--stimulus-green)",
    yellow: "var(--stimulus-yellow)",
    purple: "var(--stimulus-purple)",
    orange: "var(--stimulus-orange)",
    pink: "var(--stimulus-pink)",
    cyan: "var(--stimulus-cyan)",
  }
  return colorMap[colorName] || colorMap.blue
}

const DualNBack = () => {
  const [mounted, setMounted] = useState(false)
  const [gameState, setGameState] = useState("start") // start, playing, results
  const [nLevel, setNLevel] = useState(1)
  const [currentTrial, setCurrentTrial] = useState(0)
  const [totalTrials] = useState(20)
  const maxNLevel = 8 // Cap for realistic human performance

  // Game types
  const [enabledTypes, setEnabledTypes] = useState({
    audio: false,
    position: true,
    color: true,
    shape: false,
    number: false,
  })

  // Current stimuli
  const [currentPosition, setCurrentPosition] = useState(null)
  const [currentSound, setCurrentSound] = useState("")
  const [currentColor, setCurrentColor] = useState("")
  const [currentShape, setCurrentShape] = useState("")
  const [currentNumber, setCurrentNumber] = useState("")

  // History tracking
  const [positionHistory, setPositionHistory] = useState([])
  const [soundHistory, setSoundHistory] = useState([])
  const [colorHistory, setColorHistory] = useState([])
  const [shapeHistory, setShapeHistory] = useState([])
  const [numberHistory, setNumberHistory] = useState([])

  // User responses
  const [responses, setResponses] = useState({
    audio: false,
    position: false,
    color: false,
    shape: false,
    number: false,
  })

  // Track if each response was correct or incorrect
  const [responseCorrectness, setResponseCorrectness] = useState({
    audio: null, // null = not pressed, true = correct, false = incorrect
    position: null,
    color: null,
    shape: null,
    number: null,
  })

  // Scoring for each type
  const [scores, setScores] = useState({
    audio: { correct: 0, missed: 0, false: 0 },
    position: { correct: 0, missed: 0, false: 0 },
    color: { correct: 0, missed: 0, false: 0 },
    shape: { correct: 0, missed: 0, false: 0 },
    number: { correct: 0, missed: 0, false: 0 },
  })

  const [showInstructions, setShowInstructions] = useState(false)
  const [dailyScores, setDailyScores] = useState([])
  const [showProgress, setShowProgress] = useState(false)
  const [autoStart, setAutoStart] = useState(false)
  const [showInstructionsPage, setShowInstructionsPage] = useState(false)

  const letters = ["C", "H", "K", "L", "Q", "R", "S", "T"]
  const colors = ["red", "blue", "green", "yellow", "purple", "orange", "pink", "cyan"]
  const shapes = ["circle", "square", "triangle", "diamond", "star", "hexagon", "pentagon", "heart"]
  const numbers = ["1", "2", "3", "4", "5", "6", "7", "8"]

  const synth = useRef(null)
  const trialTimeoutRef = useRef(null)
  const responseWindowRef = useRef(null)
  const sequencesRef = useRef({ positions: [], sounds: [], colors: [], shapes: [], numbers: [] })

  useEffect(() => {
    setMounted(true)
    if (typeof window !== "undefined") {
      synth.current = window.speechSynthesis
    }
  }, [])

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("nback-daily-scores")
      if (stored) {
        try {
          setDailyScores(JSON.parse(stored))
        } catch (e) {
          console.error("Failed to load scores:", e)
        }
      }
    }
  }, [])

  useEffect(() => {
    if (gameState === "playing" && currentTrial === 0) {
      runTrial(0)
    }

    return () => {
      if (trialTimeoutRef.current) clearTimeout(trialTimeoutRef.current)
    }
  }, [gameState])

  useEffect(() => {
    if (autoStart && gameState === "start") {
      setAutoStart(false)
      startGame()
    }
  }, [nLevel, autoStart])

  if (!mounted) {
    return null
  }

  // Save score to localStorage
  const saveScore = (score) => {
    const today = new Date().toISOString().split("T")[0] // YYYY-MM-DD
    const newScore = {
      date: today,
      timestamp: new Date().toISOString(),
      nLevel,
      accuracy: Math.round(score),
      types: Object.keys(enabledTypes).filter((t) => enabledTypes[t]),
    }

    const updated = [...dailyScores, newScore]
    setDailyScores(updated)
    localStorage.setItem("nback-daily-scores", JSON.stringify(updated))
  }

  // Get stats for today
  const getTodayStats = () => {
    const today = new Date().toISOString().split("T")[0]
    const todayScores = dailyScores.filter((s) => s.date === today)
    if (todayScores.length === 0) return null

    const avgAccuracy = todayScores.reduce((sum, s) => sum + s.accuracy, 0) / todayScores.length
    const maxLevel = Math.max(...todayScores.map((s) => s.nLevel))

    return {
      sessions: todayScores.length,
      avgAccuracy: Math.round(avgAccuracy),
      maxLevel,
    }
  }

  // Generate sequences for a session
  const generateSequences = () => {
    const sequences = {
      positions: [],
      sounds: [],
      colors: [],
      shapes: [],
      numbers: [],
    }

    for (let i = 0; i < totalTrials; i++) {
      // Position
      if (enabledTypes.position) {
        if (i >= nLevel && Math.random() < 0.3) {
          sequences.positions.push(sequences.positions[i - nLevel])
        } else {
          sequences.positions.push(Math.floor(Math.random() * 9) + 1)
        }
      }

      // Audio
      if (enabledTypes.audio) {
        if (i >= nLevel && Math.random() < 0.3) {
          sequences.sounds.push(sequences.sounds[i - nLevel])
        } else {
          sequences.sounds.push(letters[Math.floor(Math.random() * letters.length)])
        }
      }

      // Color
      if (enabledTypes.color) {
        if (i >= nLevel && Math.random() < 0.3) {
          sequences.colors.push(sequences.colors[i - nLevel])
        } else {
          sequences.colors.push(colors[Math.floor(Math.random() * colors.length)])
        }
      }

      // Shape
      if (enabledTypes.shape) {
        if (i >= nLevel && Math.random() < 0.3) {
          sequences.shapes.push(sequences.shapes[i - nLevel])
        } else {
          sequences.shapes.push(shapes[Math.floor(Math.random() * shapes.length)])
        }
      }

      // Number
      if (enabledTypes.number) {
        if (i >= nLevel && Math.random() < 0.3) {
          sequences.numbers.push(sequences.numbers[i - nLevel])
        } else {
          sequences.numbers.push(numbers[Math.floor(Math.random() * numbers.length)])
        }
      }
    }

    return sequences
  }

  const speakText = (text) => {
    if (synth.current) {
      synth.current.cancel()
      const utterance = new SpeechSynthesisUtterance(text.toLowerCase())
      utterance.rate = 1.0
      utterance.pitch = 1.0
      utterance.volume = 1.0
      synth.current.speak(utterance)
    }
  }

  const toggleType = (type) => {
    setEnabledTypes((prev) => ({ ...prev, [type]: !prev[type] }))
  }

  const getEnabledCount = () => {
    return Object.values(enabledTypes).filter(Boolean).length
  }

  const renderShape = (shape, containerSize) => {
    // All shapes use 70% of their container for consistent sizing
    const size = containerSize * 0.7

    const shapes = {
      circle: <div className="rounded-full" style={{ width: size, height: size, backgroundColor: "currentColor" }} />,
      square: <div style={{ width: size, height: size, backgroundColor: "currentColor" }} />,
      triangle: (
        <div
          style={{
            width: 0,
            height: 0,
            borderLeft: `${size / 2}px solid transparent`,
            borderRight: `${size / 2}px solid transparent`,
            borderBottom: `${size * 0.87}px solid currentColor`,
          }}
        />
      ),
      diamond: (
        <div style={{ width: size, height: size, backgroundColor: "currentColor", transform: "rotate(45deg)" }} />
      ),
      star: (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ),
      hexagon: (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
          <path d="M21 16.5c0 .38-.21.71-.53.88l-7.9 4.44c-.16.12-.36.18-.57.18-.21 0-.41-.06-.57-.18l-7.9-4.44A.991.991 0 0 1 3 16.5v-9c0-.38.21-.71.53-.88l7.9-4.44c.16-.12.36-.18.57-.18.21 0 .41.06.57.18l7.9 4.44c.32.17.53.5.53.88v9z" />
        </svg>
      ),
      pentagon: (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2l7.5 5.5v8L12 22l-7.5-6.5v-8z" />
        </svg>
      ),
      heart: (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      ),
    }
    return shapes[shape] || null
  }

  const startGame = () => {
    // Generate sequences and start first trial immediately
    const sequences = generateSequences()
    sequencesRef.current = sequences
    setGameState("playing")
    setCurrentTrial(0)
    setPositionHistory([])
    setSoundHistory([])
    setColorHistory([])
    setShapeHistory([])
    setNumberHistory([])
    resetScores()
  }

  const resetScores = () => {
    setScores({
      audio: { correct: 0, missed: 0, false: 0 },
      position: { correct: 0, missed: 0, false: 0 },
      color: { correct: 0, missed: 0, false: 0 },
      shape: { correct: 0, missed: 0, false: 0 },
      number: { correct: 0, missed: 0, false: 0 },
    })
  }

  const evaluateResponse = (trialIndex, userResponses) => {
    const types = ["position", "audio", "color", "shape", "number"]
    const historyKeys = ["positions", "sounds", "colors", "shapes", "numbers"]

    types.forEach((type, idx) => {
      if (!enabledTypes[type]) return

      const historyKey = historyKeys[idx]
      const match =
        trialIndex >= nLevel &&
        sequencesRef.current[historyKey][trialIndex] === sequencesRef.current[historyKey][trialIndex - nLevel]
      const pressed = userResponses[type]

      setScores((prev) => {
        const newScores = { ...prev }
        if (match && pressed) {
          newScores[type].correct++
        } else if (match && !pressed) {
          newScores[type].missed++
        } else if (!match && pressed) {
          newScores[type].false++
        }
        return newScores
      })
    })
  }

  const runTrial = (trialIndex) => {
    if (trialIndex >= totalTrials) {
      // Save score automatically when session completes
      const { overallAccuracy } = calculateAccuracy()
      saveScore(overallAccuracy)
      setGameState("results")
      return
    }

    const position = sequencesRef.current.positions[trialIndex]
    const sound = sequencesRef.current.sounds[trialIndex]
    const color = sequencesRef.current.colors[trialIndex]
    const shape = sequencesRef.current.shapes[trialIndex]
    const number = sequencesRef.current.numbers[trialIndex]

    setCurrentPosition(enabledTypes.position ? position : null)
    setCurrentSound(enabledTypes.audio ? sound : "")
    setCurrentColor(enabledTypes.color ? color : "")
    setCurrentShape(enabledTypes.shape ? shape : "")
    setCurrentNumber(enabledTypes.number ? number : "")

    setResponses({
      audio: false,
      position: false,
      color: false,
      shape: false,
      number: false,
    })

    setResponseCorrectness({
      audio: null,
      position: null,
      color: null,
      shape: null,
      number: null,
    })

    if (enabledTypes.audio && sound) speakText(sound)
    if (enabledTypes.number && number) {
      setTimeout(() => speakText(number), 600)
    }

    // Show stimulus for 500ms
    setTimeout(() => {
      setCurrentPosition(null)
      setCurrentSound("")
      setCurrentColor("")
      setCurrentShape("")
      setCurrentNumber("")
    }, 500)

    responseWindowRef.current = {
      audio: false,
      position: false,
      color: false,
      shape: false,
      number: false,
    }

    // After 2500ms total, evaluate and move to next trial
    trialTimeoutRef.current = setTimeout(() => {
      evaluateResponse(trialIndex, responseWindowRef.current)

      setPositionHistory((prev) => [...prev, position])
      setSoundHistory((prev) => [...prev, sound])
      setColorHistory((prev) => [...prev, color])
      setShapeHistory((prev) => [...prev, shape])
      setNumberHistory((prev) => [...prev, number])
      setCurrentTrial(trialIndex + 1)
      runTrial(trialIndex + 1)
    }, 2500)
  }

  const handleResponse = (type) => {
    if (gameState === "playing" && responseWindowRef.current) {
      setResponses((prev) => ({ ...prev, [type]: true }))
      responseWindowRef.current[type] = true

      // Check if this response is correct
      const typeIndex = ["position", "audio", "color", "shape", "number"].indexOf(type)
      const historyKeys = ["positions", "sounds", "colors", "shapes", "numbers"]
      const historyKey = historyKeys[typeIndex]

      const match =
        currentTrial >= nLevel &&
        sequencesRef.current[historyKey][currentTrial] === sequencesRef.current[historyKey][currentTrial - nLevel]

      // If there's a match, pressing is correct. If no match, pressing is incorrect (false positive)
      setResponseCorrectness((prev) => ({ ...prev, [type]: match }))
    }
  }

  const calculateAccuracy = () => {
    const enabledTypesList = Object.keys(enabledTypes).filter((type) => enabledTypes[type])
    let totalAccuracy = 0
    const accuracies = {}

    enabledTypesList.forEach((type) => {
      const { correct, missed, false: falsePos } = scores[type]
      const total = correct + missed + falsePos
      accuracies[type] = total > 0 ? (correct / total) * 100 : 0
      totalAccuracy += accuracies[type]
    })

    const overallAccuracy = enabledTypesList.length > 0 ? totalAccuracy / enabledTypesList.length : 0
    return { accuracies, overallAccuracy }
  }

  const getNextLevel = () => {
    const { overallAccuracy } = calculateAccuracy()
    if (overallAccuracy >= 85) return Math.min(maxNLevel, nLevel + 1)
    if (overallAccuracy < 70 && nLevel > 1) return nLevel - 1
    return nLevel
  }

  const continueTraining = () => {
    const nextLevel = getNextLevel()
    setNLevel(nextLevel)
    setAutoStart(true)
    setGameState("start")
  }

  const exitGame = () => {
    if (trialTimeoutRef.current) clearTimeout(trialTimeoutRef.current)
    setGameState("start")
  }

  // Start screen
  if (gameState === "start") {
    const enabledCount = getEnabledCount()
    const todayStats = getTodayStats()

    return (
      <div className="max-w-[1000px] mx-auto">
        <div className="min-h-screen  p-4 flex flex-col items-center justify-center ">
          <div className="max-w-md w-full bg-card backdrop-blur-md p-6 shadow-2xl relative border-border rounded-4xl border-0 shadow-xl">
            {/* Info icon in top right */}
            <button
              onClick={() => setShowInstructionsPage(!showInstructionsPage)}
              className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center bg-muted hover:bg-accent rounded-full transition text-muted-foreground"
            >
              {showInstructionsPage ? <X size={20} /> : <Info size={20} />}
            </button>

            {showInstructionsPage ? (
              // Instructions Page
              <div className="py-8">
                <h2 className="text-2xl font-bold mb-6 text-center">How to Play</h2>

                <div className="space-y-4 text-sm">
                  <div>
                    <h3 className="font-bold text-lg mb-2">Goal</h3>
                    <p className="text-muted-foreground">
                      Remember stimuli from {nLevel} steps back. Compare what you see/hear now to what happened {nLevel}{" "}
                      trials ago.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-bold text-lg mb-2">Game Types</h3>
                    <ul className="space-y-1 text-muted-foreground">
                      <li>
                        <strong>Position:</strong> Watch squares light up on the grid
                      </li>
                      <li>
                        <strong>Letters:</strong> Listen to letters being spoken
                      </li>
                      <li>
                        <strong>Color:</strong> Remember the color of squares
                      </li>
                      <li>
                        <strong>Shape:</strong> Track shapes appearing in squares
                      </li>
                      <li>
                        <strong>Numbers:</strong> Listen to numbers being spoken
                      </li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-bold text-lg mb-2">How to Respond</h3>
                    <p className="text-muted-foreground">
                      Press the corresponding button when the current stimulus matches the one from {nLevel} trials ago.
                      You can press multiple buttons if multiple types match!
                    </p>
                  </div>

                  <div>
                    <h3 className="font-bold text-lg mb-2">Progression</h3>
                    <ul className="space-y-1 text-muted-foreground">
                      <li>
                        Get <strong>85%+</strong> accuracy → Level up! 📈
                      </li>
                      <li>
                        Get <strong>below 70%</strong> → Level down 📉
                      </li>
                      <li>
                        Between <strong>70-84%</strong> → Stay at current level
                      </li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-bold text-lg mb-2">Tips</h3>
                    <ul className="space-y-1 text-muted-foreground">
                      <li>Start with 1-2 types, then add more</li>
                      <li>Most people plateau at 3-4 back</li>
                      <li>Practice daily for best results</li>
                      <li>It should feel challenging!</li>
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              // Main Menu Content
              <>
                <div className="flex items-center gap-3 mb-8 justify-start flex-col">
                  <img src="/images/design-mode/n-back.png" alt="N-Back" className="size-28" />
                  <h1 className="font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-primary text-3xl">
                    {"Dual-N-Back"}
                  </h1>
                </div>

                {/* Today's Stats */}
                {todayStats && (
                  <button
                    onClick={() => setShowProgress(true)}
                    className="w-full border border-accent/30 rounded-xl p-3 mb-4 hover:bg-accent/30 transition text-left bg-accent text-accent-foreground"
                  >
                    <div className="flex items-center justify-between text-sm">
                      <div>
                        <div className="font-bold text-primary">Today's Progress</div>
                        <div className="text-primary">
                          {todayStats.sessions} sessions · {todayStats.avgAccuracy}% avg · max {todayStats.maxLevel}
                          -back
                        </div>
                      </div>
                      <TrendingUp className="text-primary" size={20} />
                    </div>
                  </button>
                )}

                <div className="bg-muted rounded-xl p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-muted-foreground">Level</span>
                    <div className="flex gap-2 items-center">
                      <button
                        onClick={() => setNLevel(Math.max(1, nLevel - 1))}
                        className="w-10 h-10 bg-secondary hover:bg-accent transition rounded-full flex items-center justify-center text-secondary-foreground shadow-sm"
                      >
                        <Minus size={20} />
                      </button>
                      <span className="text-lg text-primary font-semibold">{nLevel}-Back</span>
                      <button
                        onClick={() => setNLevel(Math.min(maxNLevel, nLevel + 1))}
                        className="w-10 h-10 bg-secondary hover:bg-accent transition rounded-full flex items-center justify-center text-secondary-foreground shadow-sm"
                      >
                        <Plus size={20} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Type Selection as selectable cards */}
                <div className="bg-muted rounded-xl p-4 mb-4">
                  <h3 className="text-lg mb-3 font-bold text-left text-muted-foreground">Type</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { key: "position", label: "Position" },
                      { key: "color", label: "Color" },
                      { key: "shape", label: "Shape" },
                      { key: "audio", label: "Letters" },
                      { key: "number", label: "Numbers" },
                    ].map(({ key, label }) => (
                      <button
                        key={key}
                        onClick={() => toggleType(key)}
                        className={`text-lg transition-all transform active:scale-95 px-2 py-1.5 font-medium text-primary shadow-sm rounded-lg ${
                          enabledTypes[key]
                            ? "bg-primary text-primary-foreground shadow-lg"
                            : "bg-secondary text-secondary-foreground hover:bg-accent"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={startGame}
                  disabled={enabledCount === 0}
                  className={`w-full py-4 text-xl transition transform rounded-full font-bold shadow-none ${
                    enabledCount === 0
                      ? "bg-muted text-muted-foreground cursor-not-allowed"
                      : "bg-primary text-primary-foreground hover:shadow-xl hover:scale-105"
                  } mb-0`}
                >
                  Start Training
                </button>
              </>
            )}
          </div>

          {/* Progress Modal */}
          {showProgress && (
            <div
              className="fixed inset-0 bg-black/80 flex items-start justify-center z-50 p-4 overflow-y-auto"
              onClick={() => setShowProgress(false)}
            >
              <div
                className="bg-card rounded-2xl p-6 max-w-md w-full my-4 border border-border"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold">Your Progress</h2>
                  <button
                    onClick={() => setShowProgress(false)}
                    className="w-10 h-10 flex items-center justify-center hover:bg-muted rounded-lg transition flex-shrink-0"
                  >
                    <X size={24} />
                  </button>
                </div>

                {dailyScores.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No sessions yet. Start training to track your progress!
                  </p>
                ) : (
                  <div className="space-y-3">
                    {dailyScores
                      .slice()
                      .reverse()
                      .map((score, idx) => (
                        <div key={idx} className="bg-muted rounded-lg p-3">
                          <div className="flex justify-between items-start mb-1">
                            <div className="font-bold">{new Date(score.timestamp).toLocaleDateString()}</div>
                            <div className="text-sm text-muted-foreground">
                              {new Date(score.timestamp).toLocaleTimeString()}
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="font-bold text-primary">{score.nLevel}-BACK</span>
                            <span
                              className={
                                score.accuracy >= 85
                                  ? "text-primary"
                                  : score.accuracy >= 70
                                    ? "text-accent-foreground"
                                    : "text-destructive-foreground"
                              }
                            >
                              {score.accuracy}%
                            </span>
                            <span className="text-muted-foreground">{score.types.join(", ")}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                )}

                {dailyScores.length > 0 && (
                  <button
                    onClick={() => {
                      if (window.confirm("Clear all progress data?")) {
                        localStorage.removeItem("nback-daily-scores")
                        setDailyScores([])
                        setShowProgress(false)
                      }
                    }}
                    className="w-full mt-4 py-2 bg-destructive/20 text-destructive-foreground rounded-lg hover:bg-destructive/30 transition"
                  >
                    Clear All Data
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Playing screen
  if (gameState === "playing") {
    const gridColor = currentColor || "blue"

    return (
      <div className="max-w-[1000px] mx-auto">
        <div className="min-h-screen text-foreground p-4 flex flex-col pb-40 bg-card">
          {/* Header */}
          <div className="flex justify-between items-center mb-4 relative">
            <button
              onClick={exitGame}
              className="w-12 h-12 rounded-full backdrop-blur-sm hover:bg-muted transition flex items-center justify-center border-none border-0 bg-secondary text-secondary-foreground"
            >
              <X size={24} />
            </button>
            <div className="px-4 py-2 backdrop-blur-sm border border-border border-none rounded-full text-secondary-foreground bg-secondary md:absolute md:left-1/2 md:-translate-x-1/2">
              <span className="font-bold">{nLevel}-BACK</span>
            </div>
            <div className="px-4 py-2 backdrop-blur-sm border border-border rounded-full border-none bg-muted text-muted-foreground">
              <span className="font-medium">
                Trial {currentTrial + 1}/{totalTrials}
              </span>
            </div>
          </div>

          {/* Grid - only show if position enabled */}
          {enabledTypes.position && (
            <div className="flex-1 flex items-center justify-center mb-4">
              <div className="grid grid-cols-3 gap-2 w-full max-w-sm aspect-square p-4">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((pos) => (
                  <div
                    key={pos}
                    className={`rounded-xl transition-all duration-200 flex items-center justify-center overflow-hidden relative border-none ${
                      currentPosition === pos ? `shadow-2xl` : "bg-muted border-2 border-border"
                    }`}
                    style={{
                      aspectRatio: "1/1",
                      ...(currentPosition === pos
                        ? {
                            backgroundColor: getStimulusColor(gridColor),
                            boxShadow: `0 25px 50px -12px ${getStimulusColor(gridColor)}80`,
                          }
                        : {}),
                    }}
                  >
                    {enabledTypes.shape && currentShape && currentPosition === pos && (
                      <div className="text-foreground flex items-center justify-center absolute inset-0">
                        {renderShape(currentShape, 100)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stimulus indicators */}
          <div className="space-y-3 mb-6">
            {/* Letters and Numbers combined in one row */}
            {(enabledTypes.audio || enabledTypes.number) && (
              <div className="flex justify-center items-center gap-4">
                {enabledTypes.audio && (
                  <div
                    className={`inline-flex items-center gap-2 px-6 py-3 rounded-full transition-all ${
                      currentSound ? "bg-accent shadow-lg shadow-accent/50" : "bg-muted"
                    }`}
                  >
                    <Volume2 size={24} />
                    <span className="text-2xl font-bold font-mono">{currentSound || "---"}</span>
                  </div>
                )}

                {enabledTypes.number && (
                  <div
                    className={`inline-flex items-center gap-2 px-6 py-3 rounded-full transition-all ${
                      currentNumber ? "bg-primary shadow-lg shadow-primary/50" : "bg-muted"
                    }`}
                  >
                    <span className="text-3xl font-bold font-mono">{currentNumber || "-"}</span>
                  </div>
                )}
              </div>
            )}

            {/* Color indicator - only if no grid */}
            {enabledTypes.color && !enabledTypes.position && (
              <div className="text-center">
                <div
                  className={`inline-block w-24 h-24 rounded-xl transition-all ${
                    currentColor ? "shadow-2xl" : "bg-muted"
                  }`}
                  style={
                    currentColor
                      ? {
                          backgroundColor: getStimulusColor(currentColor),
                        }
                      : {}
                  }
                />
              </div>
            )}

            {/* Shape indicator - only if no grid */}
            {enabledTypes.shape && !enabledTypes.position && (
              <div className="text-center">
                <div
                  className={`inline-flex items-center justify-center w-24 h-24 rounded-xl transition-all relative ${
                    currentShape ? "bg-accent shadow-lg" : "bg-muted"
                  }`}
                >
                  {currentShape && (
                    <div className="text-foreground absolute inset-0 flex items-center justify-center">
                      {renderShape(currentShape, 96)}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Response buttons - fixed to bottom */}
          <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background/95 to-transparent pt-6 pb-safe max-w-[1000px] mx-auto">
            <div
              className={`flex items-center px-4 pb-6 ${
                getEnabledCount() === 2 ? "justify-between" : "justify-center gap-4"
              }`}
            >
              {enabledTypes.position && (
                <button
                  onClick={() => handleResponse("position")}
                  className={`w-28 h-28 rounded-full font-bold text-base transition-all transform active:scale-90 flex items-center justify-center ${
                    responses.position
                      ? responseCorrectness.position
                        ? "bg-primary text-primary-foreground shadow-xl shadow-primary/50"
                        : "bg-destructive text-destructive-foreground shadow-xl shadow-destructive/50"
                      : "bg-card hover:bg-muted shadow-lg border border-border"
                  }`}
                >
                  {getEnabledCount() > 3 ? "Pos" : "Position"}
                </button>
              )}
              {enabledTypes.audio && (
                <button
                  onClick={() => handleResponse("audio")}
                  className={`w-28 h-28 rounded-full font-bold text-base transition-all transform active:scale-90 flex items-center justify-center ${
                    responses.audio
                      ? responseCorrectness.audio
                        ? "bg-primary text-primary-foreground shadow-xl shadow-primary/50"
                        : "bg-destructive text-destructive-foreground shadow-xl shadow-destructive/50"
                      : "bg-card hover:bg-muted shadow-lg border border-border"
                  }`}
                >
                  {getEnabledCount() > 3 ? "Let" : "Letters"}
                </button>
              )}
              {enabledTypes.color && (
                <button
                  onClick={() => handleResponse("color")}
                  className={`w-28 h-28 rounded-full font-bold text-base transition-all transform active:scale-90 flex items-center justify-center ${
                    responses.color
                      ? responseCorrectness.color
                        ? "bg-primary text-primary-foreground shadow-xl shadow-primary/50"
                        : "bg-destructive text-destructive-foreground shadow-xl shadow-destructive/50"
                      : "bg-card hover:bg-muted shadow-lg border border-border"
                  }`}
                >
                  {getEnabledCount() > 3 ? "Col" : "Color"}
                </button>
              )}
              {enabledTypes.shape && (
                <button
                  onClick={() => handleResponse("shape")}
                  className={`w-28 h-28 rounded-full font-bold text-base transition-all transform active:scale-90 flex items-center justify-center ${
                    responses.shape
                      ? responseCorrectness.shape
                        ? "bg-primary text-primary-foreground shadow-xl shadow-primary/50"
                        : "bg-destructive text-destructive-foreground shadow-xl shadow-destructive/50"
                      : "bg-card hover:bg-muted shadow-lg border border-border"
                  }`}
                >
                  {getEnabledCount() > 3 ? "Shp" : "Shape"}
                </button>
              )}
              {enabledTypes.number && (
                <button
                  onClick={() => handleResponse("number")}
                  className={`w-28 h-28 rounded-full font-bold text-base transition-all transform active:scale-90 flex items-center justify-center ${
                    responses.number
                      ? responseCorrectness.number
                        ? "bg-primary text-primary-foreground shadow-xl shadow-primary/50"
                        : "bg-destructive text-destructive-foreground shadow-xl shadow-destructive/50"
                      : "bg-card hover:bg-muted shadow-lg border border-border"
                  }`}
                >
                  {getEnabledCount() > 3 ? "Num" : "Numbers"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Results screen
  if (gameState === "results") {
    const { accuracies, overallAccuracy } = calculateAccuracy()
    const nextLevel = getNextLevel()
    const levelChange = nextLevel > nLevel ? "up" : nextLevel < nLevel ? "down" : "same"
    const enabledTypesList = Object.keys(enabledTypes).filter((type) => enabledTypes[type])

    return (
      <div className="max-w-[1000px] mx-auto">
        <div className="min-h-screen bg-gradient-to-b from-background to-secondary text-foreground p-4 flex flex-col items-center justify-center">
          <div className="max-w-md w-full bg-card backdrop-blur-md rounded-2xl p-6 shadow-2xl border border-border">
            <h2 className="font-bold text-center mb-6 text-2xl">Session Complete!</h2>

            <div className="bg-muted rounded-xl p-4 mb-3">
              <div className="text-center mb-4">
                <div className="font-bold text-primary mb-2 text-4xl">{Math.round(overallAccuracy)}%</div>
                <div className="text-sm text-muted-foreground">Overall Accuracy</div>
              </div>

              {/* Individual type accuracies */}
              <div
                className={`grid mb-4 gap-2`}
                style={{ gridTemplateColumns: `repeat(${Math.min(enabledTypesList.length, 2)}, 1fr)` }}
              >
                {enabledTypesList.map((type) => (
                  <div key={type} className="bg-card rounded-lg p-3 text-center border border-border">
                    <div className="text-2xl font-bold text-accent-foreground">{Math.round(accuracies[type])}%</div>
                    <div className="text-xs text-muted-foreground capitalize">{type}</div>
                  </div>
                ))}
              </div>

              {/* Detailed stats */}
              <div
                className={`grid text-sm gap-4`}
                style={{ gridTemplateColumns: `repeat(${Math.min(enabledTypesList.length, 2)}, 1fr)` }}
              >
                {enabledTypesList.map((type) => (
                  <div key={type} className="space-y-1">
                    <div className="text-xs font-bold capitalize text-muted-foreground mb-2">{type}</div>
                    <div className="flex justify-between">
                      <span>✓ Correct:</span>
                      <span className="font-bold text-primary">{scores[type].correct}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>✗ Missed:</span>
                      <span className="font-bold text-destructive-foreground">{scores[type].missed}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>⚠ False:</span>
                      <span className="font-bold text-accent-foreground">{scores[type].false}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div
              className={`text-center rounded-xl font-normal py-3 mb-3 ${
                levelChange === "up"
                  ? "bg-primary text-primary-foreground"
                  : levelChange === "down"
                    ? "bg-destructive text-destructive-foreground"
                    : "bg-accent text-accent-foreground"
              }`}
            >
              {levelChange === "up" && `🎉 Advancing to ${nextLevel}-BACK!`}
              {levelChange === "down" && `Dropping to ${nextLevel}-BACK`}
              {levelChange === "same" && `Staying at ${nextLevel}-BACK`}
            </div>

            <button
              onClick={continueTraining}
              className="w-full py-4 bg-primary text-primary-foreground rounded-xl shadow-lg hover:shadow-xl transition transform hover:scale-105 mb-3 font-bold text-lg"
            >
              {"Next Training"}
            </button>

            <button
              onClick={() => setGameState("start")}
              className="w-full py-3 bg-muted rounded-xl hover:bg-accent transition"
            >
              Back to Menu
            </button>
          </div>
        </div>
      </div>
    )
  }
}

export default DualNBack
