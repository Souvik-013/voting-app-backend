const express = require('express');
const router = express.Router();
const User = require('../models/user');
const { jwtAuthMiddleware, generateToken } = require('../jwt');
const Candidate = require('../models/candidate');

// Helper function to verify admin access
const checkAdminRole = async (userID) => {
    try {
        const user = await User.findById(userID);
        if (user && user.role === 'admin') {
            return true;
        }
        return false;
    } catch (err) {
        return false; 
    } 
}

// 1. GET VOTE COUNT (Public Route - Placed on top so Express handles it correctly)
router.get('/vote/count', async (req, res) => {
    try {
        // Find all candidates and sort them by voteCount in descending order
        const candidate = await Candidate.find().sort({ voteCount: 'desc' });

        // Map the candidates to only return their party name and voteCount
        const voteRecord = candidate.map((data) => {
            return {
                party: data.party,
                count: data.voteCount || 0
            }
        });

        return res.status(200).json(voteRecord);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 2. POST route to add a candidate (Admin Only)
router.post('/', jwtAuthMiddleware, async (req, res) => {
    try {
        if (!(await checkAdminRole(req.user.id))) {
            return res.status(403).json({ message: 'user does not have admin role' });
        }

        const data = req.body; // Assuming the request body contains the candidate data

        // Create a new Candidate document using the Mongoose model
        const newCandidate = new Candidate(data);

        // Save the new candidate to the database
        const response = await newCandidate.save();
        console.log('data saved');
        res.status(200).json({ response: response });
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
})

// 3. PUT route to update a candidate (Admin Only)
router.put('/:candidateID', jwtAuthMiddleware, async (req, res) => {
    try {
        if (!(await checkAdminRole(req.user.id))) {
            return res.status(403).json({ message: 'user does not have admin role' });
        }
        
        const candidateID = req.params.candidateID; // Extract the id from the URL parameter
        const updatedCandidateData = req.body; // Updated data for the person

        const response = await Candidate.findByIdAndUpdate(candidateID, updatedCandidateData, {
            new: true, // Return the updated document
            runValidators: true, // Run Mongoose validation
        })

        if (!response) {
            return res.status(404).json({ error: 'Candidate not found' });
        }

        console.log('candidate data updated');
        res.status(200).json(response);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
})

// 4. DELETE route to remove a candidate (Admin Only)
router.delete('/:candidateID', jwtAuthMiddleware, async (req, res) => {
    try {
        if (!(await checkAdminRole(req.user.id))) {
            return res.status(403).json({ message: 'user does not have admin role' });
        }
        
        const candidateID = req.params.candidateID; // Extract the id from the URL parameter

        const response = await Candidate.findByIdAndDelete(candidateID);

        if (!response) {
            return res.status(404).json({ error: 'Candidate not found' });
        }

        console.log('candidate deleted');
        res.status(200).json(response);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
})

// 5. POST route to cast a vote (UPDATED from router.get to router.post)
router.post('/vote/:candidateID', jwtAuthMiddleware, async (req, res) => {
    const candidateID = req.params.candidateID;
    const userId = req.user.id;

    try {
        // Find the Candidate document with the specified candidateID
        const candidate = await Candidate.findById(candidateID);
        if (!candidate) {
            return res.status(404).json({ message: 'Candidate not found' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'user not found' });
        }
        if (user.role === 'admin') {
            return res.status(403).json({ message: 'admin is not allowed' });
        }
        if (user.isVoted) {
            return res.status(400).json({ message: 'You have already voted' });
        }

        // Update the Candidate document to record the vote
        candidate.votes.push({ user: userId });
        candidate.voteCount++;
        await candidate.save();

        // Update the user document
        user.isVoted = true;
        await user.save();

        return res.status(200).json({ message: 'Vote recorded successfully' });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 6. GET List of all candidates with only name and party fields (Public Route)
router.get('/', async (req, res) => {
    try {
        // Find all candidates and select only the name and party fields, excluding _id
        const candidates = await Candidate.find({}, 'name party -_id');

        // Return the list of candidates
        res.status(200).json(candidates);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;