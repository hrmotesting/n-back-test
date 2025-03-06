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
  
  // Submit results to GHL webhook with status
  const submitResults = async (status = 'completed') => {
    try {
      const accuracy = score.total > 0 ? (score.correct / score.total) * 100 : 0;
      
      // This is your actual webhook URL
      const webhookUrl = 'https://services.leadconnectorhq.com/hooks/YAxaIdy0u9P2IAPJGLRR/webhook-trigger/0b65edb5-dfaa-45b0-9fb0-1e0e1a590b21';
      
      // Use a CORS proxy service temporarily for testing
      const corsProxyUrl = 'https://corsproxy.io/?';
      
      // Prepare the data
      const data = {
        firstName,
        email,
        testType: `${nLevel}-Back Test`,
        testStatus: status,
        totalTrials: score.total,
        correctResponses: score.correct,
        incorrectResponses: score.incorrect,
        accuracy: accuracy.toFixed(2),
        date: new Date().toISOString()
      };
      
      console.log('Sending webhook data:', data);
      
      // Send through the proxy
      const response = await fetch(corsProxyUrl + encodeURIComponent(webhookUrl), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });
      
      console.log('Webhook response status:', response.status);
      
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
        
        // Send webhook with completed status
        submitResults('completed');
        
        setScreen('results');
      }
    }, 2500); // Show each letter for 2.5 seconds
    
    return () => clearTimeout(timer);
  }, [currentIndex, isTestRunning, sequence, userResponses.length, trialCount, nLevel]);
  
  // Set timeout for user response - count no response as incorrect
  useEffect(() => {
    if (!isTestRunning || currentIndex < 0 || currentIndex < nLevel) return;
    
    // Set a timeout for user response (slightly shorter than the letter display time)
    const responseTimeout = setTimeout(() => {
      // If the user hasn't responded yet, count it as incorrect
      if (isTestRunning && currentIndex >= nLevel) {
        const userResponsesForCurrent = userResponses.filter(r => r.index === currentIndex);
        
        // If no response has been logged for this letter yet
        if (userResponsesForCurrent.length === 0) {
          const actualMatch = sequence[currentIndex] === sequence[currentIndex - nLevel];
          
          setFeedback('incorrect');
          setTimeout(() => setFeedback(null), 500);
          
          setScore(prevScore => ({
            correct: prevScore.correct,
            incorrect: prevScore.incorrect + 1,
            total: prevScore.total + 1
          }));
          
          setUserResponses(prev => [...prev, { 
            index: currentIndex,
            stimulus: sequence[currentIndex],
            nBackStimulus: sequence[currentIndex - nLevel],
            actualMatch: actualMatch,
            userResponse: null, // Indicates no response
            isCorrect: false
          }]);
        }
      }
    }, 2200); // Set to 2200ms, slightly less than the 2500ms letter display time
    
    return () => clearTimeout(responseTimeout);
  }, [currentIndex, isTestRunning, nLevel, sequence, userResponses]);
  
  // Reset test when n-level changes
  useEffect(() => {
    if (isTestRunning) {
      setIsTestRunning(false);
      setCurrentIndex(-1);
    }
  }, [nLevel]);
  
  // Track when users abandon the test
  useEffect(() => {
    const handleBeforeUnload = (event) => {
      // If user has registered but not completed the test
      if (screen !== 'welcome' && screen !== 'results') {
        // Determine status based on screen
        const status = (screen === 'registration' || screen === 'instructions') ? 'not_started' : 'abandoned';
        
        // Prepare data
        const data = {
          firstName,
          email,
          testType: `${nLevel}-Back Test`,
          testStatus: status,
          totalTrials: score.total,
          correctResponses: score.correct,
          incorrectResponses: score.incorrect,
          accuracy: score.total > 0 ? ((score.correct / score.total) * 100).toFixed(2) : "0.00",
          date: new Date().toISOString()
        };
        
        // Try sendBeacon as it's more reliable during page unload
        if (navigator.sendBeacon) {
          const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
          navigator.sendBeacon('https://corsproxy.io/?https://services.leadconnectorhq.com/hooks/YAxaIdy0u9P2IAPJGLRR/webhook-trigger/0b65edb5-dfaa-45b0-9fb0-1e0e1a590b21', blob);
        }
        
        // Show confirmation message
        event.preventDefault();
        event.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [screen, firstName, email, nLevel, score]);
  
  // Render based on current screen
  const renderScreen = () => {
    switch (screen) {
      case 'welcome':
        return (
          <div style={{ 
            width: '500px',
            height: '430px',
            padding: '24px',
            boxSizing: 'border-box',
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <h1 style={{ color: '#502a12', fontSize: '28px', fontWeight: 500, marginBottom: '16px' }}>2-Back Cognitive Assessment</h1>
            <p style={{ color: '#502a12', marginBottom: '24px' }}>
              Welcome to the 2-Back Test, a cognitive assessment tool that measures working memory and fluid intelligence.
            </p>
            <button 
              onClick={() => setScreen('registration')}
              style={{ 
                backgroundColor: '#ff005e',
                color: 'white',
                border: 'none',
                borderRadius: '50px',
                padding: '10px 24px',
                fontFamily: 'Bitter, serif',
                fontSize: '16px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
            >
              Get Started
            </button>
          </div>
        );
        
      case 'registration':
        return (
          <div style={{ 
            width: '500px',
            height: '430px',
            padding: '24px',
            boxSizing: 'border-box',
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
            position: 'relative'
          }}>
            <h1 style={{ color: '#502a12', fontSize: '24px', fontWeight: 500, marginBottom: '20px', textAlign: 'center' }}>Registration</h1>
            <div style={{ marginBottom: '24px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', color: '#502a12', marginBottom: '8px', fontWeight: 500 }} htmlFor="firstName">
                  First Name <span style={{ color: '#ff005e' }}>*</span>
                </label>
                <input
                  id="firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  style={{ 
                    width: '100%', 
                    padding: '10px 12px',
                    border: !firstName.trim() ? '1px solid #ff005e' : '1px solid #ccc',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontFamily: 'Bitter, serif',
                    color: '#502a12',
                    boxSizing: 'border-box'
                  }}
                  required
                />
                {!firstName.trim() && <p style={{ color: '#ff005e', margin: '4px 0 0 0', fontSize: '14px' }}>First name is required</p>}
              </div>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', color: '#502a12', marginBottom: '8px', fontWeight: 500 }} htmlFor="email">
                  Email Address <span style={{ color: '#ff005e' }}>*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ 
                    width: '100%', 
                    padding: '10px 12px',
                    border: email.trim() === '' ? '1px solid #ff005e' : !/^\S+@\S+\.\S+$/.test(email) && email.trim() !== '' ? '1px solid orange' : '1px solid #ccc',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontFamily: 'Bitter, serif',
                    color: '#502a12',
                    boxSizing: 'border-box'
                  }}
                  required
                />
                {email.trim() === '' && <p style={{ color: '#ff005e', margin: '4px 0 0 0', fontSize: '14px' }}>Email address is required</p>}
                {!/^\S+@\S+\.\S+$/.test(email) && email.trim() !== '' && <p style={{ color: 'orange', margin: '4px 0 0 0', fontSize: '14px' }}>Please enter a valid email address</p>}
              </div>
              
              <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '16px' }}>
                <input
                  id="terms"
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  style={{ 
                    marginRight: '10px', 
                    marginTop: '4px',
                    width: '16px',
                    height: '16px'
                  }}
                  required
                />
                <div>
                  <label style={{ color: '#502a12', fontWeight: 500, fontSize: '15px' }} htmlFor="terms">
                    I accept the <a href="#" style={{ color: '#ff005e', textDecoration: 'underline' }}>Terms and Conditions</a> <span style={{ color: '#ff005e' }}>*</span>
                  </label>
                  {!acceptedTerms && <p style={{ color: '#ff005e', margin: '4px 0 0 0', fontSize: '14px' }}>You must accept the terms and conditions</p>}
                </div>
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', position: 'absolute', bottom: '24px', left: 0, right: 0 }}>
              <button 
                onClick={() => setScreen('welcome')}
                style={{ 
                  backgroundColor: '#f0f0f0',
                  color: '#502a12',
                  border: 'none',
                  borderRadius: '50px',
                  padding: '10px 24px',
                  fontFamily: 'Bitter, serif',
                  fontSize: '16px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
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
                    // Submit the registration info
                    submitResults('registered');
                    setScreen('instructions');
                  } else {
                    alert(errorMessage);
                  }
                }}
                style={{ 
                  backgroundColor: '#ff005e',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50px',
                  padding: '10px 24px',
                  fontFamily: 'Bitter, serif',
                  fontSize: '16px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
              >
                Continue
              </button>
            </div>
          </div>
        );
        
      case 'instructions':
        return (
          <div style={{ 
            width: '500px',
            height: '430px',
            padding: '24px',
            boxSizing: 'border-box',
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <h1 style={{ color: '#502a12', fontSize: '24px', fontWeight: 500, marginBottom: '20px', textAlign: 'center' }}>{nLevel}-Back Test Instructions</h1>
            
            <div style={{ flex: 1, overflowY: 'auto', color: '#502a12', marginBottom: '16px' }}>
              <p style={{ marginBottom: '12px' }}>
                In this test, you will see a sequence of letters, one at a time.
              </p>
              <p style={{ marginBottom: '12px' }}>
                Your task is to identify when the <strong>current letter</strong> matches the letter that appeared <strong>{nLevel} positions back</strong> in the sequence.
              </p>
              <p style={{ marginBottom: '12px' }}>
                For example, in a 3-back test with the sequence: <span style={{ fontFamily: 'monospace', background: '#f5f5f5', padding: '2px 6px', borderRadius: '4px' }}>T, H, G, <strong>T</strong>, ...</span>
                <br />
                The 4th letter (T) matches the letter that appeared 3 positions earlier.
              </p>
              <p style={{ marginBottom: '12px' }}>
                Press <strong>Match</strong> if the current letter matches the one {nLevel} positions back.
                <br />
                Press <strong>No Match</strong> if they are different.
              </p>
              <p style={{ marginBottom: '12px' }}>
                You'll receive immediate feedback after each response.
              </p>
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', color: '#502a12', marginBottom: '8px', fontWeight: 500 }} htmlFor="nLevel">
                Difficulty Level (n-back):
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <input
                  id="nLevel"
                  type="range"
                  min="1"
                  max={maxLevel}
                  value={nLevel}
                  onChange={(e) => setNLevel(parseInt(e.target.value))}
                  style={{ 
                    flex: '1',
                    height: '8px',
                    borderRadius: '4px',
                    accentColor: '#ff005e'
                  }}
                />
                <span style={{ color: '#ff005e', fontSize: '20px', fontWeight: 'bold' }}>{nLevel}</span>
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button 
                onClick={() => setScreen('registration')}
                style={{ 
                  backgroundColor: '#f0f0f0',
                  color: '#502a12',
                  border: 'none',
                  borderRadius: '50px',
                  padding: '10px 24px',
                  fontFamily: 'Bitter, serif',
                  fontSize: '16px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
              >
                Back
              </button>
              <button 
                onClick={() => {
                  setScreen('test');
                  startTest();
                  // Send webhook when user starts the test
                  submitResults('started');
                }}
                style={{ 
                  backgroundColor: '#ff005e',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50px',
                  padding: '10px 24px',
                  fontFamily: 'Bitter, serif',
                  fontSize: '16px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
              >
                Start Test
              </button>
            </div>
          </div>
        );
        
      case 'test':
        return (
          <div style={{ 
            width: '500px',
            height: '430px',
            padding: '24px',
            boxSizing: 'border-box',
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <h1 style={{ color: '#502a12', fontSize: '24px', fontWeight: 500, marginBottom: '16px', textAlign: 'center' }}>{nLevel}-Back Test</h1>
            
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', color: '#502a12' }}>
                <span>Progress:</span>
                <span>{currentIndex + 1} / {sequence.length}</span>
              </div>
              <div style={{ width: '100%', height: '10px', backgroundColor: '#f0f0f0', borderRadius: '5px', overflow: 'hidden' }}>
                <div 
                  style={{ 
                    height: '100%', 
                    backgroundColor: '#ff005e', 
                    width: `${((currentIndex + 1) / sequence.length) * 100}%`,
                    transition: 'width 0.3s ease'
                  }}
                ></div>
              </div>
            </div>
            
            <div style={{ 
              width: '160px',
              height: '160px',
              margin: '0 auto 24px auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '8px',
              border: '4px solid',
              borderColor: feedback === 'correct' ? '#4CAF50' : feedback === 'incorrect' ? '#ff4d4d' : '#ff005e',
              backgroundColor: feedback === 'correct' ? '#e8f5e9' : feedback === 'incorrect' ? '#ffebee' : 'white',
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
            }}>
              <span style={{ 
                fontSize: '80px', 
                fontWeight: 'bold', 
                color: '#502a12',
                transition: 'all 0.3s ease'
              }}>
                {currentIndex >= 0 && sequence[currentIndex]}
              </span>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: '16px' }}>
              <button 
                onClick={() => handleResponse(false)}
                disabled={currentIndex < nLevel || !isTestRunning}
                style={{ 
                  backgroundColor: '#ff4d4d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50px',
                  padding: '12px 24px',
                  fontFamily: 'Bitter, serif',
                  fontSize: '16px',
                  fontWeight: 500,
                  cursor: (currentIndex < nLevel || !isTestRunning) ? 'not-allowed' : 'pointer',
                  opacity: (currentIndex < nLevel || !isTestRunning) ? 0.5 : 1,
                  transition: 'all 0.3s ease'
                }}
              >
                No Match
              </button>
              <button 
                onClick={() => handleResponse(true)}
                disabled={currentIndex < nLevel || !isTestRunning}
                style={{ 
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50px',
                  padding: '12px 24px',
                  fontFamily: 'Bitter, serif',
                  fontSize: '16px',
                  fontWeight: 500,
                  cursor: (currentIndex < nLevel || !isTestRunning) ? 'not-allowed' : 'pointer',
                  opacity: (currentIndex < nLevel || !isTestRunning) ? 0.5 : 1,
                  transition: 'all 0.3s ease'
                }}
              >
                Match
              </button>
            </div>
            
            {currentIndex < nLevel && (
              <div style={{ textAlign: 'center', marginBottom: '8px', color: '#502a12' }}>
                {nLevel - currentIndex} more letters needed before you can start responding...
              </div>
            )}
            
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button 
                onClick={() => {
                  setIsTestRunning(false);
                  setScreen('instructions');
                  // Send webhook when user quits test
                  submitResults('abandoned');
                }}
                style={{ 
                  backgroundColor: '#f0f0f0',
                  color: '#502a12',
                  border: 'none',
                  borderRadius: '50px',
                  padding: '10px 24px',
                  fontFamily: 'Bitter, serif',
                  fontSize: '16px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
              >
                Quit Test
              </button>
            </div>
          </div>
        );
        
      case 'results':
        const accuracy = score.total > 0 ? (score.correct / score.total) * 100 : 0;
        
        return (
          <div style={{ 
            width: '500px',
            height: '430px',
            padding: '24px',
            boxSizing: 'border-box',
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <h1 style={{ color: '#502a12', fontSize: '24px', fontWeight: 500, marginBottom: '16px', textAlign: 'center' }}>Test Results</h1>
            
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <h2 style={{ color: '#502a12', fontSize: '20px', fontWeight: 500, marginBottom: '12px' }}>Performance Summary</h2>
              <div style={{ backgroundColor: '#f9f9f9', borderRadius: '8px', padding: '16px', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid #eee' }}>
                  <span style={{ color: '#502a12' }}>Test Type:</span>
                  <span style={{ color: '#502a12', fontWeight: 500 }}>{nLevel}-Back Test</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid #eee' }}>
                  <span style={{ color: '#502a12' }}>Total Trials:</span>
                  <span style={{ color: '#502a12', fontWeight: 500 }}>{score.total}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid #eee' }}>
                  <span style={{ color: '#502a12' }}>Correct Responses:</span>
                  <span style={{ color: '#4CAF50', fontWeight: 500 }}>{score.correct}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid #eee' }}>
                  <span style={{ color: '#502a12' }}>Incorrect Responses:</span>
                  <span style={{ color: '#ff4d4d', fontWeight: 500 }}>{score.incorrect}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#502a12' }}>Accuracy:</span>
                  <span style={{ color: '#ff005e', fontWeight: 500 }}>{accuracy.toFixed(2)}%</span>
                </div>
              </div>
              
              <div style={{ textAlign: 'center', marginTop: '16px', color: '#502a12' }}>
                <p>Your results have been recorded.</p>
                <p>Thank you for participating in the assessment!</p>
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
              <button 
                onClick={() => {
                  setScreen('instructions');
                }}
                style={{ 
                  backgroundColor: '#ff005e',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50px',
                  padding: '10px 24px',
                  fontFamily: 'Bitter, serif',
                  fontSize: '16px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
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
    <div style={{ 
      width: '500px',
      height: '430px',
      margin: '0 auto',
      backgroundColor: 'transparent',
      fontFamily: 'Bitter, serif',
      overflow: 'hidden',
      position: 'relative'
    }}>
      {renderScreen()}
    </div>
  );
};

export default NBackTestApp;