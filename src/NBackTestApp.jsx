import React, { useState, useEffect, useCallback } from 'react';

const NBackTestApp = () => {
  // States for different screens
  const [screen, setScreen] = useState('welcome'); // welcome, registration, instructions, test, results
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  
  // Test states
  const [nLevel, setNLevel] = useState(2); // Default n-level is 2
  const [maxLevel, setMaxLevel] = useState(9); // Maximum n-level available
  const [sequence, setSequence] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [userResponses, setUserResponses] = useState([]);
  const [score, setScore] = useState({ correct: 0, incorrect: 0, total: 0 });
  const [feedback, setFeedback] = useState(null); // null, 'correct', 'incorrect'
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [trialCount, setTrialCount] = useState(30); // Exactly 30 trials per test
  
  // Letters to use in the test
  const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'Q', 'R', 'S', 'T'];
  
  // Generate sequence for the test with controlled match frequency
  const generateSequence = useCallback(() => {
    // Standard n-back tests typically have around 30% matches
    const targetMatchRate = 0.3; // 30% matches
    const numberOfMatches = Math.round(trialCount * targetMatchRate);
    
    // Create an initial random sequence
    const newSequence = [];
    for (let i = 0; i < trialCount; i++) {
      const randomIndex = Math.floor(Math.random() * letters.length);
      newSequence.push(letters[randomIndex]);
    }
    
    // For positions that can have matches (index >= nLevel)
    // We'll create a list of eligible positions for matches
    const eligiblePositions = [];
    for (let i = nLevel; i < trialCount; i++) {
      eligiblePositions.push(i);
    }
    
    // Shuffle the eligible positions
    for (let i = eligiblePositions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [eligiblePositions[i], eligiblePositions[j]] = [eligiblePositions[j], eligiblePositions[i]];
    }
    
    // Select positions for matches
    const matchPositions = eligiblePositions.slice(0, numberOfMatches);
    
    // Create matches at the selected positions
    for (const pos of matchPositions) {
      newSequence[pos] = newSequence[pos - nLevel]; // Make it match n positions back
    }
    
    // Ensure exactly 30 trials
    if (newSequence.length < 30) {
      const extraNeeded = 30 - newSequence.length;
      for (let i = 0; i < extraNeeded; i++) {
        const randomIndex = Math.floor(Math.random() * letters.length);
        newSequence.push(letters[randomIndex]);
      }
    } else if (newSequence.length > 30) {
      newSequence.length = 30;
    }
    
    setSequence(newSequence);
  }, [trialCount, nLevel, letters]);
  
  // Handle user response
  const handleResponse = (isMatch) => {
    if (currentIndex < nLevel) return; // Not enough letters shown yet
    
    const actualMatch = sequence[currentIndex] === sequence[currentIndex - nLevel];
    const isCorrect = isMatch === actualMatch;
    
    setFeedback(isCorrect ? 'correct' : 'incorrect');
    setTimeout(() => setFeedback(null), 500);
    
    setScore(prevScore => ({
      correct: prevScore.correct + (isCorrect ? 1 : 0),
      incorrect: prevScore.incorrect + (isCorrect ? 0 : 1),
      total: prevScore.total + 1
    }));
    
    setUserResponses(prev => [...prev, { 
      index: currentIndex,
      stimulus: sequence[currentIndex],
      nBackStimulus: sequence[currentIndex - nLevel],
      actualMatch: actualMatch,
      userResponse: isMatch,
      isCorrect: isCorrect
    }]);
  };
  
  // Start the test
  const startTest = () => {
    generateSequence();
    setCurrentIndex(-1);
    setUserResponses([]);
    setScore({ correct: 0, incorrect: 0, total: 0 });
    setFeedback(null);
    setIsTestRunning(true);
    setTimeout(() => setCurrentIndex(0), 1000);
  };
  
  // Submit results to GHL webhook
  const submitResults = async () => {
    try {
      const accuracy = score.total > 0 ? (score.correct / score.total) * 100 : 0;
      
      // This is your actual webhook URL
      const webhookUrl = 'https://services.leadconnectorhq.com/hooks/YAxaIdy0u9P2IAPJGLRR/webhook-trigger/8825105d-d4e5-40f1-a679-95bb15252fa0';
      
      const data = {
        firstName,
        email,
        testType: `${nLevel}-Back Test`,
        totalTrials: score.total,
        correctResponses: score.correct,
        incorrectResponses: score.incorrect,
        accuracy: accuracy.toFixed(2),
        date: new Date().toISOString()
      };
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error('Failed to submit results');
      }
      
      console.log('Results submitted:', data);
      return true;
    } catch (error) {
      console.error('Error submitting results:', error);
      return false;
    }
  };
  
  // Advance to next letter in sequence
  useEffect(() => {
    if (!isTestRunning || currentIndex < 0) return;
    
    const timer = setTimeout(() => {
      if (currentIndex < sequence.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        // Test complete
        setIsTestRunning(false);
        
        // Verify test data before showing results
        if (userResponses.length < trialCount - nLevel) {
          console.warn(`Incomplete responses: ${userResponses.length} out of ${trialCount - nLevel} expected`);
        }
        
        // Log match distribution
        let actualMatches = 0;
        for (let i = nLevel; i < sequence.length; i++) {
          if (sequence[i] === sequence[i - nLevel]) {
            actualMatches++;
          }
        }
        console.log(`Test contained ${actualMatches} matches out of ${sequence.length - nLevel} possible trials (${((actualMatches/(sequence.length - nLevel))*100).toFixed(1)}%)`);
        
        setScreen('results');
      }
    }, 2500); // Show each letter for 2.5 seconds
    
    return () => clearTimeout(timer);
  }, [currentIndex, isTestRunning, sequence, userResponses.length, trialCount, nLevel]);
  
  // Reset test when n-level changes
  useEffect(() => {
    if (isTestRunning) {
      setIsTestRunning(false);
      setCurrentIndex(-1);
    }
  }, [nLevel]);
  
  // Render based on current screen
  const renderScreen = () => {
    switch (screen) {
        case 'welcome':
            return (
              <div className="flex flex-col items-center justify-center p-8 space-y-8 bg-white rounded-lg shadow-lg max-w-md w-full">
                <h1 className="text-3xl font-bold text-teal-600">2-Back Cognitive Assessment</h1>
                <p className="text-center text-gray-700">
                  Welcome to the 2-Back Test, a cognitive assessment tool that measures working memory and fluid intelligence.
                </p>
                <button 
                  onClick={() => setScreen('registration')}
                  className="px-6 py-2 rounded-full bg-teal-500 text-white font-semibold hover:bg-teal-600 transition-colors"
                >
                  Get Started
                </button>
              </div>
            );
        
      case 'registration':
        return (
          <div className="card">
            <h1 className="title">Registration</h1>
            <div className="form-group">
              <label htmlFor="firstName">First Name *</label>
              <input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={`input ${!firstName.trim() ? 'input-error' : ''}`}
                required
              />
              {!firstName.trim() && <p className="error-text">First name is required</p>}
            </div>
            
            <div className="form-group">
              <label htmlFor="email">Email Address *</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`input ${email.trim() === '' ? 'input-error' : !/^\S+@\S+\.\S+$/.test(email) && email.trim() !== '' ? 'input-error' : ''}`}
                required
              />
              {email.trim() === '' && <p className="error-text">Email address is required</p>}
              {!/^\S+@\S+\.\S+$/.test(email) && email.trim() !== '' && <p className="error-text">Please enter a valid email address</p>}
            </div>
            
            <div className="checkbox-group">
              <input
                id="terms"
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="checkbox"
                required
              />
              <div>
                <label htmlFor="terms">
                  I accept the <a href="#" style={{color: '#0d9488'}}>Terms and Conditions</a> *
                </label>
                {!acceptedTerms && <p className="error-text">You must accept the terms and conditions</p>}
              </div>
            </div>
            
            <div className="flex-row">
              <button 
                onClick={() => setScreen('welcome')}
                className="button button-secondary"
              >
                Back
              </button>
              <button 
                onClick={() => {
                  // Validate each field individually
                  let isValid = true;
                  let errorMessage = '';
                  
                  if (!firstName.trim()) {
                    isValid = false;
                    errorMessage = 'Please enter your first name.';
                  } else if (!email.trim()) {
                    isValid = false;
                    errorMessage = 'Please enter your email address.';
                  } else if (!/^\S+@\S+\.\S+$/.test(email)) {
                    isValid = false;
                    errorMessage = 'Please enter a valid email address.';
                  } else if (!acceptedTerms) {
                    isValid = false;
                    errorMessage = 'Please accept the terms and conditions.';
                  }
                  
                  if (isValid) {
                    setScreen('instructions');
                  } else {
                    alert(errorMessage);
                  }
                }}
                className="button"
              >
                Continue
              </button>
            </div>
          </div>
        );
        
      case 'instructions':
        return (
          <div className="card">
            <h1 className="title">{nLevel}-Back Test Instructions</h1>
            
            <div>
              <p>
                In this test, you will see a sequence of letters, one at a time.
              </p>
              <p>
                Your task is to identify when the <strong>current letter</strong> matches the letter that appeared <strong>{nLevel} positions back</strong> in the sequence.
              </p>
              <p>
                For example, in a 3-back test with the sequence: <span style={{fontFamily: 'monospace'}}>T, H, G, <strong>T</strong>, ...</span>
                <br />
                The 4th letter (T) matches the letter that appeared 3 positions earlier.
              </p>
              <p>
                Press <strong>Match</strong> if the current letter matches the one {nLevel} positions back.
                <br />
                Press <strong>No Match</strong> if they are different.
              </p>
              <p>
                You'll receive immediate feedback after each response.
              </p>
            </div>
            
            <div className="form-group">
              <label htmlFor="nLevel">Difficulty Level (n-back):</label>
              <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                <input
                  id="nLevel"
                  type="range"
                  min="1"
                  max={maxLevel}
                  value={nLevel}
                  onChange={(e) => setNLevel(parseInt(e.target.value))}
                  style={{width: '100%'}}
                />
                <span style={{fontSize: '1.25rem', fontWeight: 'bold', color: '#0d9488'}}>{nLevel}</span>
              </div>
            </div>
            
            <div className="flex-row">
              <button 
                onClick={() => setScreen('registration')}
                className="button button-secondary"
              >
                Back
              </button>
              <button 
                onClick={() => {
                  setScreen('test');
                  startTest();
                }}
                className="button"
              >
                Start Test
              </button>
            </div>
          </div>
        );
        
      case 'test':
        return (
          <div className="card">
            <h1 className="title">{nLevel}-Back Test</h1>
            
            <div className="progress-container">
              <div className="progress-label">
                <span>Progress:</span>
                <span>{currentIndex + 1} / {sequence.length}</span>
              </div>
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${((currentIndex + 1) / sequence.length) * 100}%` }}
                ></div>
              </div>
            </div>
            
            <div className={`letter-display ${
              feedback === 'correct' ? 'letter-correct' : 
              feedback === 'incorrect' ? 'letter-incorrect' : ''
            }`}>
              <span>
                {currentIndex >= 0 && sequence[currentIndex]}
              </span>
            </div>
            
            <div className="flex-row">
              <button 
                onClick={() => handleResponse(false)}
                disabled={currentIndex < nLevel || !isTestRunning}
                className={`button button-red`}
                style={{opacity: (currentIndex < nLevel || !isTestRunning) ? 0.5 : 1}}
              >
                No Match
              </button>
              <button 
                onClick={() => handleResponse(true)}
                disabled={currentIndex < nLevel || !isTestRunning}
                className={`button button-green`}
                style={{opacity: (currentIndex < nLevel || !isTestRunning) ? 0.5 : 1}}
              >
                Match
              </button>
            </div>
            
            {currentIndex < nLevel && (
              <div className="text-center" style={{marginTop: '1rem'}}>
                {nLevel - currentIndex} more letters needed before you can start responding...
              </div>
            )}
            
            <div className="flex-row" style={{marginTop: '1rem'}}>
              <button 
                onClick={() => {
                  setIsTestRunning(false);
                  setScreen('instructions');
                }}
                className="button button-secondary"
              >
                Quit Test
              </button>
            </div>
          </div>
        );
        
      case 'results':
        const accuracy = score.total > 0 ? (score.correct / score.total) * 100 : 0;
        
        return (
          <div className="card">
            <h1 className="title">Test Results</h1>
            
            <div>
              <h2 style={{fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem'}}>Performance Summary</h2>
              <div className="results-container">
                <div className="results-row">
                  <span>Test Type:</span>
                  <span style={{fontWeight: 600}}>{nLevel}-Back Test</span>
                </div>
                <div className="results-row">
                  <span>Total Trials:</span>
                  <span style={{fontWeight: 600}}>{score.total}</span>
                </div>
                <div className="results-row">
                  <span>Correct Responses:</span>
                  <span className="correct-text">{score.correct}</span>
                </div>
                <div className="results-row">
                  <span>Incorrect Responses:</span>
                  <span className="incorrect-text">{score.incorrect}</span>
                </div>
                <div className="results-row">
                  <span>Accuracy:</span>
                  <span style={{fontWeight: 600}}>{accuracy.toFixed(2)}%</span>
                </div>
              </div>
              
              <div className="text-center" style={{margin: '1rem 0'}}>
                <p>Your results have been recorded.</p>
                <p>Thank you for participating in the assessment!</p>
              </div>
            </div>
            
            <div className="flex-row">
              <button 
                onClick={() => {
                  submitResults();
                  setScreen('instructions');
                }}
                className="button"
              >
                Try Again
              </button>
            </div>
          </div>
        );
        
      default:
        return <div>Error: Unknown screen</div>;
    }
  };
  
  return (
    <div className="container">
      <div style={{width: '100%', maxWidth: '550px'}}>
        {renderScreen()}
      </div>
    </div>
  );
};

export default NBackTestApp;