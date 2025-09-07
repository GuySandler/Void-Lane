const canvas = document.getElementById("gameCanvas");
canvas.height = window.innerHeight;
canvas.width = window.innerWidth;

const engine = new BABYLON.Engine(canvas, true);

let buildmode = true;
let scene;
let playCamera;
let buildCamera;
let platformMaterial;
let keys = {}; // Track pressed keys

const createBaseScene = () => {
    const scene = new BABYLON.Scene(engine);
	BABYLON.Tags.EnableFor(scene);

	playCamera = new BABYLON.ArcRotateCamera("playCamera", Math.PI / 2, Math.PI / 2.5, 20, BABYLON.Vector3.Zero(), scene);
	playCamera.fov = 0.8;
	// playCamera.attachControl(canvas, true);

	buildCamera = new BABYLON.ArcRotateCamera("buildCamera", Math.PI / 2, Math.PI / 2.5, 20, BABYLON.Vector3.Zero(), scene);
	buildCamera.fov = 0.8;
	buildCamera.attachControl(canvas, true);

	scene.activeCamera = buildCamera;

    const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
    light.intensity = 0.85;

	const player = BABYLON.MeshBuilder.CreateBox("player", { height: .25, width: 1, depth: 1 }, scene);
	const playerMaterial = new BABYLON.StandardMaterial(
		"playerMaterial",
		scene
	);
	playerMaterial.diffuseColor = new BABYLON.Color3(1, 0, 1);
	player.material = playerMaterial;
	player.position.y = 0.25;

	const startPlatform = BABYLON.MeshBuilder.CreateBox("startPlatform", { height: .5, width: 5, depth: 5 }, scene);
	startPlatform.position.y = -0.25;
	BABYLON.Tags.AddTagsTo(startPlatform, "platform");

	platformMaterial = new BABYLON.StandardMaterial("platformMaterial", scene);
	platformMaterial.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.5);
	startPlatform.material = platformMaterial;

    return scene;
};

let gravityVector = new BABYLON.Vector3(0, -9.81, 0);
let havokInstance;

scene = createBaseScene();

const initializePhysics = async () => {
	scene.enablePhysics(gravityVector, new BABYLON.CannonJSPlugin());
	setTimeout(() => {
		addPhysicsToExistingMeshes();
	}, 100);
};

initializePhysics();

function addPhysicsToExistingMeshes() {
	if (!scene.getPhysicsEngine()) {
		console.error("Physics engine not available");
		return;
	}

	const player = scene.getMeshByName("player");
	if (player) {
		try {
			player.physicsImpostor = new BABYLON.PhysicsImpostor(player, BABYLON.PhysicsImpostor.BoxImpostor, { 
				mass: 1, 
				restitution: 0.3,
				friction: 0.5
			}, scene);
			console.log("Physics added to player");
		} catch (error) {
			console.error("Failed to add physics to player:", error);
		}
	}

	const platforms = scene.getMeshesByTags("platform");
	platforms.forEach((platform, index) => {
		try {
			platform.physicsImpostor = new BABYLON.PhysicsImpostor(platform, BABYLON.PhysicsImpostor.BoxImpostor, { 
				mass: 0,
				restitution: 0.7,
				friction: 0.8
			}, scene);
			console.log(`Physics added to platform ${index + 1}`);
		} catch (error) {
			console.error(`Failed to add physics to platform ${index + 1}:`, error);
		}
	});
}

function gameLoop() {
	if (!buildmode) {
		handlePlayerMovement();
	}
}

function handlePlayerMovement() {
	const player = scene.getMeshByName("player");
	if (!player || !player.physicsImpostor) return;
	
	const moveSpeed = 5;
	const jumpForce = 8;
	const velocity = player.physicsImpostor.getLinearVelocity();

	let moveX = 0;
	let moveZ = 0;
	
	if (keys['KeyW'] || keys['ArrowUp']) moveZ = moveSpeed;
	if (keys['KeyS'] || keys['ArrowDown']) moveZ = -moveSpeed;
	if (keys['KeyA'] || keys['ArrowLeft']) moveX = -moveSpeed;
	if (keys['KeyD'] || keys['ArrowRight']) moveX = moveSpeed;

	player.physicsImpostor.setLinearVelocity(new BABYLON.Vector3(moveX, velocity.y, moveZ));

	if (keys['Space'] && Math.abs(velocity.y) < 0.1) {
		player.physicsImpostor.applyImpulse(new BABYLON.Vector3(0, jumpForce, 0), player.getAbsolutePosition());
	}

	if (playCamera && scene.activeCamera === playCamera) {
		const playerPos = player.position;
		playCamera.setTarget(playerPos);

		const cameraOffset = new BABYLON.Vector3(0, 5, -10);
		const desiredCameraPos = playerPos.add(cameraOffset);
		playCamera.position = BABYLON.Vector3.Lerp(playCamera.position, desiredCameraPos, 0.1);
	}
}

engine.runRenderLoop(() => {
	gameLoop();
	if (scene) {
		scene.render();
	}
});

window.addEventListener("resize", () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    engine.resize();
});

window.addEventListener("keydown", (event) => {
	keys[event.code] = true;
});

window.addEventListener("keyup", (event) => {
	keys[event.code] = false;
});

window.addEventListener("click", (event) => {
	if (buildmode) {
		getClick(event);
	}
});

function switchMode() {
	buildmode = !buildmode;
	const button = document.getElementById("switchMode");
	const player = scene.getMeshByName("player");
	
	if (buildmode) {
		button.textContent = "Building Mode";
		scene.activeCamera = buildCamera;
		buildCamera.attachControls(canvas);
	} else {
		button.textContent = "Play Mode";
		scene.activeCamera = playCamera;
		buildCamera.detachControls();
		
		if (player) {
			const playerPos = player.position;
			playCamera.setTarget(playerPos);
			playCamera.position = playerPos.add(new BABYLON.Vector3(0, 5, -10));
			playCamera.attachControls(canvas);
		}
	}
}

let firstClickPoint = null;

function getClick(event, step=1) {
	const rect = canvas.getBoundingClientRect();
	const x = event.clientX - rect.left;
	const y = event.clientY - rect.top;

	const pickInfo = scene.pick(x, y);
	
	let finalPoint = null;
	
	if (pickInfo.hit) {
		const pickedPoint = pickInfo.pickedPoint;
		const pickedMesh = pickInfo.pickedMesh;

		finalPoint = pickedPoint;

		if (snapmode == true) {
			// get nearest snap indicator
			const snapIndicators = scene.getMeshesByTags("snapIndicator");
			let nearestIndicator;
			let nearestDistance = 10;
			for (const indicator of snapIndicators) {
				const distance = BABYLON.Vector3.Distance(indicator.position, pickedPoint);
				if (distance < nearestDistance) {
					nearestDistance = distance;
					nearestIndicator = indicator;
				}
			}
			if (nearestIndicator) {
				finalPoint = nearestIndicator.position;
			}
		}
	} else {
		if (firstClickPoint !== null) {
			const ray = scene.createPickingRay(x, y, BABYLON.Matrix.Identity(), scene.activeCamera);
			const firstPointDistance = BABYLON.Vector3.Distance(scene.activeCamera.position, firstClickPoint);
			finalPoint = ray.origin.add(ray.direction.scale(firstPointDistance));
		} else {
			console.log("First click must be on a surface. Click on a mesh first.");
			return null;
		}
	}

	if (finalPoint) {
		if (firstClickPoint === null) {
			if (!pickInfo.hit) {
				console.log("First click must be on a surface. Click on a mesh first.");
				return null;
			}
			firstClickPoint = finalPoint.clone();
			createClickIndicator(finalPoint);
			console.log("First point selected. Click again (anywhere) to create platform.");
			return finalPoint;
		} else {
			const secondPoint = finalPoint;
			createPlatformBetweenPoints(firstClickPoint, secondPoint);
			firstClickPoint = null;
			console.log("Platform created between points.");
			return secondPoint;
		}
	}
}

function createPlatformBetweenPoints(point1, point2) {
	const directionVector = point2.subtract(point1);
	const distance = directionVector.length();

	const normalizedDirection = directionVector.normalize();
	const centerPoint = point1.add(normalizedDirection.scale(distance / 2));
	const platform = BABYLON.MeshBuilder.CreateBox("platform", {
		height: 0.5,
		width: 5,
		depth: distance
	}, scene);

	platform.position = centerPoint;

	const yaw = Math.atan2(normalizedDirection.x, normalizedDirection.z);
	const pitch = Math.asin(-normalizedDirection.y);

	platform.rotation.y = yaw;
	platform.rotation.x = pitch;
	BABYLON.Tags.AddTagsTo(platform, "platform");

	platform.material = platformMaterial;

	if (scene.getPhysicsEngine()) {
		platform.physicsImpostor = new BABYLON.PhysicsImpostor(platform, BABYLON.PhysicsImpostor.BoxImpostor, { 
			mass: 0,
			restitution: 0.7,
			friction: 0.8
		}, scene);
	}

	if (snapmode) {
		const snapIndicators = scene.getMeshesByTags("snapIndicator");
		for (const indicator of snapIndicators) {
			indicator.dispose();
		}
		snapMode();
	}
}

function createClickIndicator(position) {
	const existingIndicator = scene.getMeshByName("clickIndicator");
	if (existingIndicator) {
		existingIndicator.dispose();
	}

	const indicator = BABYLON.MeshBuilder.CreateSphere("clickIndicator", { diameter: 0.2 }, scene);
	const indicatorMaterial = new BABYLON.StandardMaterial("indicatorMaterial", scene);
	indicatorMaterial.diffuseColor = new BABYLON.Color3(1, 1, 0);
	indicator.material = indicatorMaterial;
	indicator.position = position.clone();

	setTimeout(() => {
		if (indicator) {
			indicator.dispose();
		}
	}, 2000);
}
let snapmode = false;
function snapMode() {
	const button = document.getElementById("snapMode");
	if (button.textContent === "Snap Mode: On") {
		button.textContent = "Snap Mode: Off";
		const snapIndicators = scene.getMeshesByTags("snapIndicator");
		for (const indicator of snapIndicators) {
			indicator.dispose();
		}
		snapmode = false;
	} else {
		snapmode = true;
		button.textContent = "Snap Mode: On";
		const platforms = scene.getMeshesByTags("platform");
		// console.log(platforms);
		for (const platform of platforms) {
			const position = platform.position;

			const boundingInfo = platform.getBoundingInfo();
			const boundingBox = boundingInfo.boundingBox;

			const halfWidth = boundingBox.extendSize.x;
			const halfHeight = boundingBox.extendSize.y;
			const halfDepth = boundingBox.extendSize.z;

			const corners = [
				new BABYLON.Vector3(position.x - halfWidth, position.y + halfHeight, position.z + halfDepth),
				new BABYLON.Vector3(position.x + halfWidth, position.y + halfHeight, position.z + halfDepth),
				new BABYLON.Vector3(position.x - halfWidth, position.y + halfHeight, position.z - halfDepth),
				new BABYLON.Vector3(position.x + halfWidth, position.y + halfHeight, position.z - halfDepth),
				new BABYLON.Vector3(position.x - halfWidth, position.y - halfHeight, position.z + halfDepth),
				new BABYLON.Vector3(position.x + halfWidth, position.y - halfHeight, position.z + halfDepth),
				new BABYLON.Vector3(position.x - halfWidth, position.y - halfHeight, position.z - halfDepth),
				new BABYLON.Vector3(position.x + halfWidth, position.y - halfHeight, position.z - halfDepth),
			];

			const faceCenters = [
				new BABYLON.Vector3(position.x, position.y + halfHeight, position.z),
				new BABYLON.Vector3(position.x, position.y - halfHeight, position.z),
				new BABYLON.Vector3(position.x, position.y, position.z + halfDepth),
				new BABYLON.Vector3(position.x, position.y, position.z - halfDepth),
				new BABYLON.Vector3(position.x - halfWidth, position.y, position.z),
				new BABYLON.Vector3(position.x + halfWidth, position.y, position.z),
			];
			
			const midEdges = [
				
				new BABYLON.Vector3(position.x, position.y + halfHeight, position.z + halfDepth),
				new BABYLON.Vector3(position.x, position.y + halfHeight, position.z - halfDepth),
				new BABYLON.Vector3(position.x - halfWidth, position.y + halfHeight, position.z),
				new BABYLON.Vector3(position.x + halfWidth, position.y + halfHeight, position.z),
				
				new BABYLON.Vector3(position.x, position.y - halfHeight, position.z + halfDepth),
				new BABYLON.Vector3(position.x, position.y - halfHeight, position.z - halfDepth),
				new BABYLON.Vector3(position.x - halfWidth, position.y - halfHeight, position.z),
				new BABYLON.Vector3(position.x + halfWidth, position.y - halfHeight, position.z),

				new BABYLON.Vector3(position.x - halfWidth, position.y, position.z + halfDepth),
				new BABYLON.Vector3(position.x + halfWidth, position.y, position.z + halfDepth),
				new BABYLON.Vector3(position.x - halfWidth, position.y, position.z - halfDepth),
				new BABYLON.Vector3(position.x + halfWidth, position.y, position.z - halfDepth),
			];

			const snapPoints = [...corners, ...faceCenters, ...midEdges];

			for (const point of snapPoints) {
				const snapIndicator = BABYLON.MeshBuilder.CreateBox("snapIndicator", { size: 0.1 }, scene);
				BABYLON.Tags.AddTagsTo(snapIndicator, "snapIndicator");
				const snapMaterial = new BABYLON.StandardMaterial("snapMaterial", scene);
				snapMaterial.diffuseColor = new BABYLON.Color3(0, 1, 1);
				snapIndicator.material = snapMaterial;
				snapIndicator.position = point.clone();
			}
		}
	}
}
