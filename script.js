
document.addEventListener("DOMContentLoaded", function() {
    const searchButton = document.getElementById("search-btn");
    const usernameInput = document.getElementById("user-input");
    const statsContainer = document.querySelector(".stats-container");
    const easyProgressCircle = document.querySelector(".easy-progress");
    const mediumProgressCircle = document.querySelector(".medium-progress");
    const hardProgressCircle = document.querySelector(".hard-progress");
    const easyLabel = document.getElementById("easy-label");
    const mediumLabel = document.getElementById("medium-label");
    const hardLabel = document.getElementById("hard-label");
    const cardStatsContainer = document.querySelector(".stats-cards");
    const errorDisplay = document.createElement("div");
    errorDisplay.className = "error-message";
    statsContainer.appendChild(errorDisplay);

    // Return a true or false based on regex validation
    function validateUsername(username) {
        if (username.trim() === "") {
            showError("Username can't be empty");
            return false;
        }
        const regex = /^[a-zA-Z0-9_-]{1,15}$/;
        const isMatching = regex.test(username);
        if (!isMatching) {
            showError("Invalid Username - must be 1-15 characters, only letters, numbers, underscore, or hyphen");
        }
        return isMatching;
    }

    function showError(message) {
        errorDisplay.textContent = message;
        errorDisplay.style.display = "block";
        setTimeout(() => {
            errorDisplay.style.display = "none";
        }, 5000);
    }

    async function fetchUserDetails(username) {
        try {
            searchButton.textContent = "Searching...";
            searchButton.disabled = true;
            errorDisplay.style.display = "none";
            
            // Method 1: Try direct API first (if allowed by CORS)
            try {
                const leetcodeResponse = await fetch(`https://leetcode-stats-api.herokuapp.com/${username}`);
                if (leetcodeResponse.ok) {
                    const data = await leetcodeResponse.json();
                    displayUserData(data);
                    return;
                }
            } catch (error) {
                console.log("Direct API request failed, trying GraphQL approach...");
            }

            // Method 2: Try LeetCode GraphQL API with multiple CORS proxy options
            const proxyList = [
                "https://corsproxy.io/?",
                "https://api.allorigins.win/raw?url="
            ];
            
            const targetUrl = 'https://leetcode.com/graphql/';
            const myHeaders = new Headers();
            myHeaders.append("content-type", "application/json");

            const graphQL = JSON.stringify({
                query: `
                    query userPublicProfile($username: String!) {
                        allQuestionsCount {
                            difficulty
                            count
                        }
                        matchedUser(username: $username) {
                            username
                            submitStats: submitStatsGlobal {
                                acSubmissionNum {
                                    difficulty
                                    count
                                    submissions
                                }
                                totalSubmissionNum {
                                    difficulty
                                    count
                                    submissions
                                }
                            }
                        }
                    }
                `,
                variables: { "username": username }
            });

            const requestOptions = {
                method: "POST",
                headers: myHeaders,
                body: graphQL,
                redirect: "follow"
            };

            // Try each proxy in sequence until one works
            let success = false;
            for (const proxy of proxyList) {
                if (success) break;
                
                try {
                    const response = await fetch(proxy + encodeURIComponent(targetUrl), requestOptions);
                    if (response.ok) {
                        const parsedData = await response.json();
                        if (parsedData.data && parsedData.data.matchedUser) {
                            displayUserData(parsedData);
                            success = true;
                            break;
                        } else {
                            throw new Error("Invalid data structure received");
                        }
                    }
                } catch (proxyError) {
                    console.log(`Proxy ${proxy} failed:`, proxyError);
                }
            }

            // If none of the proxies worked, try fallback approach
            if (!success) {
                try {
                    // Fallback method - use a public CORS proxy service
                    const fallbackUrl = `https://leetcode-stats-api.herokuapp.com/${username}`;
                    const fallbackResponse = await fetch(fallbackUrl);
                    
                    if (fallbackResponse.ok) {
                        const apiData = await fallbackResponse.json();
                        processApiData(apiData);
                        return;
                    } else {
                        throw new Error("All methods failed to fetch user data");
                    }
                } catch (fallbackError) {
                    throw fallbackError;
                }
            }
        } catch (error) {
            console.error("Error fetching data:", error);
            showError(`No data found for username: ${username}. Please check the spelling and try again.`);
            statsContainer.innerHTML = `<p class="no-data">No Data Found</p>`;
        } finally {
            searchButton.textContent = "Search";
            searchButton.disabled = false;
        }
    }
    
    function processApiData(apiData) {
        // This function processes data from the leetcode-stats-api
        // Format it to match what the display function expects
        if (apiData.status === "success") {
            const formattedData = {
                data: {
                    allQuestionsCount: [
                        { difficulty: "All", count: apiData.totalQuestions },
                        { difficulty: "Easy", count: apiData.totalEasy },
                        { difficulty: "Medium", count: apiData.totalMedium },
                        { difficulty: "Hard", count: apiData.totalHard }
                    ],
                    matchedUser: {
                        submitStats: {
                            acSubmissionNum: [
                                { difficulty: "All", count: apiData.totalSolved },
                                { difficulty: "Easy", count: apiData.easySolved },
                                { difficulty: "Medium", count: apiData.mediumSolved },
                                { difficulty: "Hard", count: apiData.hardSolved },
                                { submissions: apiData.totalSolved * 3 } // Estimated submission count
                            ],
                            totalSubmissionNum: [
                                { difficulty: "All", submissions: apiData.totalSolved * 3 }, // Estimated
                                { difficulty: "Easy", submissions: apiData.easySolved * 2 }, // Estimated
                                { difficulty: "Medium", submissions: apiData.mediumSolved * 3 }, // Estimated
                                { difficulty: "Hard", submissions: apiData.hardSolved * 4 } // Estimated
                            ]
                        }
                    }
                }
            };
            displayUserData(formattedData);
        } else {
            throw new Error("Invalid API response");
        }
    }
    
    function updateProgress(solved, total, label, circle) {
        const progressDegree = (solved / total) * 100;
        circle.style.setProperty("--progress-degree", `${progressDegree}%`);
        label.textContent = `${solved}/${total}`;
    }

    function displayUserData(parsedData) {
        // Check if using the API format or GraphQL format
        if (parsedData.data) {
            // GraphQL format
            const totalQues = parsedData.data.allQuestionsCount[0].count;
            const totalEasyQues = parsedData.data.allQuestionsCount[1].count;
            const totalMediumQues = parsedData.data.allQuestionsCount[2].count;
            const totalHardQues = parsedData.data.allQuestionsCount[3].count;

            const solvedTotalQues = parsedData.data.matchedUser.submitStats.acSubmissionNum[0].count;
            const solvedTotalEasyQues = parsedData.data.matchedUser.submitStats.acSubmissionNum[1].count;
            const solvedTotalMediumQues = parsedData.data.matchedUser.submitStats.acSubmissionNum[2].count;
            const solvedTotalHardQues = parsedData.data.matchedUser.submitStats.acSubmissionNum[3].count;

            updateProgress(solvedTotalEasyQues, totalEasyQues, easyLabel, easyProgressCircle);
            updateProgress(solvedTotalMediumQues, totalMediumQues, mediumLabel, mediumProgressCircle);
            updateProgress(solvedTotalHardQues, totalHardQues, hardLabel, hardProgressCircle);

            const cardsData = [
                {label: "Total Submissions:", value: parsedData.data.matchedUser.submitStats.totalSubmissionNum[0].submissions},
                {label: "Easy Submissions:", value: parsedData.data.matchedUser.submitStats.totalSubmissionNum[1].submissions},
                {label: "Medium Submissions:", value: parsedData.data.matchedUser.submitStats.totalSubmissionNum[2].submissions},
                {label: "Hard Submissions:", value: parsedData.data.matchedUser.submitStats.totalSubmissionNum[3].submissions},
            ];

            cardStatsContainer.innerHTML = cardsData.map(
                data => {
                    return `<div class="card">
                        <h4>${data.label}</h4>
                        <p>${data.value}</p>
                    </div>`;
                }
            ).join("");
        } else {
            // Direct API format
            updateProgress(parsedData.easySolved, parsedData.totalEasy, easyLabel, easyProgressCircle);
            updateProgress(parsedData.mediumSolved, parsedData.totalMedium, mediumLabel, mediumProgressCircle);
            updateProgress(parsedData.hardSolved, parsedData.totalHard, hardLabel, hardProgressCircle);

            const cardsData = [
                {label: "Acceptance Rate:", value: parsedData.acceptanceRate + "%"},
                {label: "Ranking:", value: parsedData.ranking},
                {label: "Total Solved:", value: parsedData.totalSolved},
                {label: "Contribution Points:", value: parsedData.contributionPoints || 0},
            ];

            cardStatsContainer.innerHTML = cardsData.map(
                data => {
                    return `<div class="card">
                        <h4>${data.label}</h4>
                        <p>${data.value}</p>
                    </div>`;
                }
            ).join("");
        }
    }

    searchButton.addEventListener('click', function() {
        const username = usernameInput.value;
        if (validateUsername(username)) {
            fetchUserDetails(username);
        }
    });

    // Also allow pressing Enter key to search
    usernameInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            const username = usernameInput.value;
            if (validateUsername(username)) {
                fetchUserDetails(username);
            }
        }
    });
});
