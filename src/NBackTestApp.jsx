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
      const webhookUrl = 'https://services.leadconnectorhq.com/hooks/YAxaIdy0u9P2IAPJGLRR/webhook-trigger/e9d05fe5-985d-4026-8a06-8c310b626927';
      
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
              <div className="card p-10 max-w-xl w-full mx-auto" style={{ background: 'white' }}>
                {/* rest of the content */}
              </div>
            );
        
      case 'registration':
        return (
          <div className="card p-10 m-4 max-w-xl w-full mx-auto">
            <h1 className="text-3xl font-medium text-center mb-6" style={{ color: '#502a12' }}>Registration</h1>
            <div className="space-y-6 mb-6">
              <div>
                <label className="block mb-2 font-medium" style={{ color: '#502a12' }} htmlFor="firstName">First Name <span className="text-red-500">*</span></label>
                <input
                  id="firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 font-bitter ${!firstName.trim() ? 'border-red-300 focus:ring-red-200' : 'border-gray-300 focus:ring-pink-200'}`}
                  style={{ color: '#502a12', fontFamily: 'Bitter' }}
                  required
                />
                {!firstName.trim() && <p className="mt-1 text-sm text-red-500">First name is required</p>}
              </div>
              
              <div>
                <label className="block mb-2 font-medium" style={{ color: '#502a12' }} htmlFor="email">Email Address <span className="text-red-500">*</span></label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 font-bitter ${email.trim() === '' ? 'border-red-300 focus:ring-red-200' : !/^\S+@\S+\.\S+$/.test(email) && email.trim() !== '' ? 'border-orange-300 focus:ring-orange-200' : 'border-gray-300 focus:ring-pink-200'}`}
                  style={{ color: '#502a12', fontFamily: 'Bitter' }}
                  required
                />
                {email.trim() === '' && <p className="mt-1 text-sm text-red-500">Email address is required</p>}
                {!/^\S+@\S+\.\S+$/.test(email) && email.trim() !== '' && <p className="mt-1 text-sm text-orange-500">Please enter a valid email address</p>}
              </div>
              
              <div className="flex items-start">
                <input
                  id="terms"
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className={`mt-1 mr-3 h-5 w-5 rounded ${!acceptedTerms ? 'ring-2 ring-red-300' : ''}`}
                  required
                />
                <div>
                  <label className="font-medium" style={{ color: '#502a12' }} htmlFor="terms">
                    I accept the <a href="#" style={{ color: '#ff005e', textDecoration: 'underline' }}>Terms and Conditions</a> <span className="text-red-500">*</span>
                  </label>
                  {!acceptedTerms && <p className="mt-1 text-sm text-red-500">You must accept the terms and conditions</p>}
                </div>
              </div>
            </div>
            
            <div className="flex justify-center space-x-4">
              <button 
                onClick={() => setScreen('welcome')}
                className="button-secondary"
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
                className="button-primary"
              >
                Continue
              </button>
            </div>
          </div>
        );
        
      case 'instructions':
        return (
          <div className="card p-10 m-4 max-w-xl w-full mx-auto">
            <h1 className="text-3xl font-medium text-center mb-6" style={{ color: '#502a12' }}>{nLevel}-Back Test Instructions</h1>
            
            <div className="space-y-4 mb-8" style={{ color: '#502a12' }}>
              <p>
                In this test, you will see a sequence of letters, one at a time.
              </p>
              <p>
                Your task is to identify when the <strong>current letter</strong> matches the letter that appeared <strong>{nLevel} positions back</strong> in the sequence.
              </p>
              <p>
                For example, in a 3-back test with the sequence: <span className="font-mono bg-gray-100 px-2 py-1 rounded">T, H, G, <strong>T</strong>, ...</span>
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
            
            <div className="mb-8">
              <label className="block mb-2 font-medium" style={{ color: '#502a12' }} htmlFor="nLevel">Difficulty Level (n-back):</label>
              <div className="flex items-center space-x-4">
                <input
                  id="nLevel"
                  type="range"
                  min="1"
                  max={maxLevel}
                  value={nLevel}
                  onChange={(e) => setNLevel(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer"
                  style={{ accentColor: '#ff005e' }}
                />
                <span className="text-xl font-bold" style={{ color: '#ff005e' }}>{nLevel}</span>
              </div>
            </div>
            
            <div className="flex justify-center space-x-4">
              <button 
                onClick={() => setScreen('registration')}
                className="button-secondary"
              >
                Back
              </button>
              <button 
                onClick={() => {
                  setScreen('test');
                  startTest();
                }}
                className="button-primary"
              >
                Start Test
              </button>
            </div>
          </div>
        );
        
      case 'test':
        return (
          <div className="card p-10 m-4 max-w-xl w-full mx-auto">
            <h1 className="text-3xl font-medium text-center mb-6" style={{ color: '#502a12' }}>{nLevel}-Back Test</h1>
            
            <div className="mb-6">
              <div className="flex justify-between mb-2" style={{ color: '#502a12' }}>
                <span>Progress:</span>
                <span>{currentIndex + 1} / {sequence.length}</span>
              </div>
              <div className="w-full h-3 bg-gray-200 rounded-full">
                <div 
                  className="h-3 rounded-full" 
                  style={{ 
                    width: `${((currentIndex + 1) / sequence.length) * 100}%`,
                    backgroundColor: '#ff005e',
                    transition: 'width 0.3s ease'
                  }}
                ></div>
              </div>
            </div>
            
            <div 
              className={`letter-display w-40 h-40 mx-auto flex items-center justify-center rounded-lg border-4 mb-8 ${
                feedback === 'correct' ? 'border-green-500 bg-green-50' : 
                feedback === 'incorrect' ? 'border-red-500 bg-red-50' : 
                'border-pink-300 bg-white'
              }`}
              style={{ 
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
                transition: 'all 0.3s ease' 
              }}
            >
              <span className="text-8xl font-bold" style={{ color: '#502a12' }}>
                {currentIndex >= 0 && sequence[currentIndex]}
              </span>
            </div>
            
            <div className="flex justify-center space-x-4 mb-6">
              <button 
                onClick={() => handleResponse(false)}
                disabled={currentIndex < nLevel || !isTestRunning}
                className="button-primary"
                style={{ 
                  backgroundColor: '#ff4d4d', 
                  opacity: (currentIndex < nLevel || !isTestRunning) ? 0.5 : 1,
                  cursor: (currentIndex < nLevel || !isTestRunning) ? 'not-allowed' : 'pointer' 
                }}
              >
                No Match
              </button>
              <button 
                onClick={() => handleResponse(true)}
                disabled={currentIndex < nLevel || !isTestRunning}
                className="button-primary"
                style={{ 
                  backgroundColor: '#4CAF50', 
                  opacity: (currentIndex < nLevel || !isTestRunning) ? 0.5 : 1,
                  cursor: (currentIndex < nLevel || !isTestRunning) ? 'not-allowed' : 'pointer'
                }}
              >
                Match
              </button>
            </div>
            
            {currentIndex < nLevel && (
              <div className="text-center mb-6" style={{ color: '#502a12' }}>
                {nLevel - currentIndex} more letters needed before you can start responding...
              </div>
            )}
            
            <div className="flex justify-center">
              <button 
                onClick={() => {
                  setIsTestRunning(false);
                  setScreen('instructions');
                }}
                className="button-secondary"
              >
                Quit Test
              </button>
            </div>
          </div>
        );
        
      case 'results':
        const accuracy = score.total > 0 ? (score.correct / score.total) * 100 : 0;
        
        return (
          <div className="card p-10 m-4 max-w-xl w-full mx-auto">
            <h1 className="text-3xl font-medium text-center mb-6" style={{ color: '#502a12' }}>Test Results</h1>
            
            <div className="mb-8">
              <h2 className="text-2xl font-medium mb-4" style={{ color: '#502a12' }}>Performance Summary</h2>
              <div className="bg-gray-50 p-6 rounded-lg" style={{ boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)' }}>
                <div className="flex justify-between items-center mb-3 pb-3 border-b border-gray-200">
                  <span style={{ color: '#502a12' }}>Test Type:</span>
                  <span className="font-medium" style={{ color: '#502a12' }}>{nLevel}-Back Test</span>
                </div>
                <div className="flex justify-between items-center mb-3 pb-3 border-b border-gray-200">
                  <span style={{ color: '#502a12' }}>Total Trials:</span>
                  <span className="font-medium" style={{ color: '#502a12' }}>{score.total}</span>
                </div>
                <div className="flex justify-between items-center mb-3 pb-3 border-b border-gray-200">
                  <span style={{ color: '#502a12' }}>Correct Responses:</span>
                  <span className="font-medium text-green-600">{score.correct}</span>
                </div>
                <div className="flex justify-between items-center mb-3 pb-3 border-b border-gray-200">
                  <span style={{ color: '#502a12' }}>Incorrect Responses:</span>
                  <span className="font-medium text-red-600">{score.incorrect}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span style={{ color: '#502a12' }}>Accuracy:</span>
                  <span className="font-medium" style={{ color: '#ff005e' }}>{accuracy.toFixed(2)}%</span>
                </div>
              </div>
              
              <div className="text-center mt-6" style={{ color: '#502a12' }}>
                <p>Your results have been recorded.</p>
                <p>Thank you for participating in the assessment!</p>
              </div>
            </div>
            
            <div className="flex justify-center">
              <button 
                onClick={() => {
                  submitResults();
                  setScreen('instructions');
                }}
                className="button-primary"
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
    <div style={{ fontFamily: 'Bitter, serif', background: 'transparent' }}>
      {renderScreen()}
    </div>
  );
};

export default NBackTestApp;